---
title: "Development Study Day 1: How a Web Request Travels"
date: "2026-11-24"
category: "Development"
series: "Development Study"
part: 1
description: "What a backend does, the anatomy of HTTP requests and URLs, DNS and ports, TCP and HTTPS, how one request passes through four network layers, and forward versus reverse proxies."
draft: false
---

## HTTP in brief

A **client** (browser or app) sends a **request**; the **server**, the backend, applies the service's rules, reads or writes the **database**, and returns a **response**. The agreed format for both is HTTP, which is plain text:

```
POST /posts HTTP/1.1                         ← method, path, version
Host: myblog.com                             ← headers
Content-Type: application/json

{"title": "First post", "content": "Hello"}  ← body (JSON)
```

```
HTTP/1.1 201 Created                         ← status code
Content-Type: application/json

{"id": 3, "title": "First post", "content": "Hello"}
```

The **method** says what to do: GET reads, POST creates, PUT and PATCH update, DELETE deletes. The **status code** summarizes the result: 2xx success, 4xx a client mistake (400 malformed, 401 not logged in, 404 not found), 5xx a server mistake (500).

Deleting a comment that has already been deleted commonly returns **404 Not Found**. Some APIs return **204 No Content** instead, since the desired end state already holds. Which one to return is an API design decision made by the backend developer.

## URLs, DNS, IP addresses, and ports

A URL such as `https://www.naver.com:443/news/list?page=2` has five parts: the **protocol** (`https`), the **host** (`www.naver.com`), the **port** (`:443`, usually omitted), the **path** (`/news/list`), and the **query string** (`?page=2`).

Three points are easy to get wrong:

- In `http://localhost:8080/posts/3`, `localhost` is the **host**, not the path; it means "this computer itself". The path begins at the first `/` after the host, so it is `/posts/3`, leading slash included.
- When the port is omitted, the browser uses the protocol's default: **80 for http, 443 for https**.
- Typing an address into the address bar always sends **GET**. The address bar can only ask to read. POST comes from a page or app submitting data, such as a sign-up form, which is why POST APIs are tested with tools like Postman or curl.

<div class="explainer" data-explainer="dev-url"></div>

Computers find each other by numeric **IP addresses** such as `223.130.200.104`, not by names. **DNS** translates a name into an IP address, like a phone book. Because DNS only translates, a client that already knows the IP address can connect even when DNS fails (some large sites refuse direct IP access for security reasons, but the principle holds). The IP address identifies the machine; the **port** identifies the program on it: 80 for HTTP, 443 for HTTPS, 3306 for MySQL, and 8080 for a Spring Boot application by default.

### Is there one IP address per server?

As a first approximation, one machine has one address. In practice the relationship breaks in both directions.

- **One machine can have several IP addresses.** A typical case is a **private IP**, valid only inside an organization's or home network, alongside a **public IP** visible on the internet. A laptop behind a home router receives a private address such as `192.168.0.x`, while the router holds the public address. The relationship resembles an apartment complex: the street address is public, the unit number is meaningful only inside the complex.
- **One IP address can front many machines.** A large service runs hundreds of servers, yet users connect to a single address. A **load balancer** sits at that address and distributes requests across the servers behind it. This returns in the system design part of the study plan.

## Networks are built in layers

Sending one HTTP request involves several protocols stacked on top of each other. Each layer uses the layer below it and performs only its own job, much as a shipping company separates packing, sealing, registered handling, and trucking.

| Layer | Protocol | What it does | What identifies the target |
|---|---|---|---|
| Application | HTTP | Format of requests and responses | Method, path |
| Security | TLS | Encryption and server authentication | Certificate |
| Transport | TCP / UDP | Delivery between **programs** | Port |
| Network | IP | Delivery between **computers** | IP address |

### One request passes through all four layers

The table does not describe four separate requests. A single `GET` request passes **down** all four layers on the sending machine and back **up** all four on the receiving machine. On the way down, each layer wraps what it received from above inside its own header. This is called **encapsulation**. On the way up, each layer removes its own header and passes the rest upward.

Following a request for `https://shop.com/posts/3`:

1. **HTTP** builds the message: `GET /posts/3 HTTP/1.1`, `Host: shop.com`.
2. **TLS** encrypts the entire message. From outside it is now unreadable.
3. **TCP** adds a header with the source port, the destination port (443), and a sequence number.
4. **IP** adds a header with the source and destination IP addresses.

The packet that leaves the machine is nested like this:

<figure class="dev-diagram"><div data-diagram="packet"></div><figcaption>The packet that leaves the machine. Each layer wraps the one inside it: IP decides which computer, TCP which program and which byte, TLS keeps the HTTP message unreadable in transit.</figcaption></figure>

**Routers** along the way read only the outermost IP header and forward the packet toward the destination address. They do not open the inner layers, and because of TLS they could not read them anyway.

On the server, the layers are removed in reverse order:

- **IP** confirms that the destination address is its own and removes the IP header.
- **TCP** sees port 443, reorders the bytes by sequence number, sends an acknowledgement, and hands the data to the program on port 443.
- **TLS** decrypts the data with the session key and recovers the original HTTP text.
- **HTTP**: the server reads `GET /posts/3`. Application code, such as a Spring controller, starts here.

The response travels the same way in the opposite direction.

<div class="explainer" data-explainer="dev-layers"></div>

Because each layer reads only its own header, the layers are independent: HTTP does not care whether bytes travel over Wi-Fi or LTE, and IP does not care what the payload is. Spring works only at the HTTP layer; the operating system and the web server software handle TCP, TLS, and IP, so application code receives an already unwrapped `GET /posts/3`.

## TCP

### Why IP alone is not enough

IP is comparable to ordinary mail: it delivers toward an address but takes no responsibility for loss, delay, or ordering. Data travels as **packets** of roughly 1,500 bytes or less, through many routers. A busy router may drop packets, and packets taking different paths can arrive out of order. IP does not correct either problem; it is a *best-effort* service.

An HTML page with a missing or shuffled middle section is unusable, which is why TCP exists.

### What TCP guarantees

TCP builds a **reliable byte stream** on top of IP: bytes written by the sender arrive at the receiving program **completely, in order, and exactly once**. It is comparable to registered mail: every item is numbered, receipt is confirmed, and anything unconfirmed is sent again. Three mechanisms provide this.

1. **Sequence numbers.** Every byte sent is numbered.
2. **Acknowledgements (ACKs).** The receiver reports the next byte number it expects.

   ```
   Client → Server: seq=1001, 500 bytes of data (bytes 1001–1500)
   Server → Client: ack=1501   ("received up to 1500; 1501 is next")
   ```

   Out-of-order arrivals are reordered by number, and duplicates are discarded by number.
3. **Retransmission.** If no ACK arrives within a time limit, the sender assumes loss and resends.

### Connection setup: the three-way handshake

Sequence numbers only work if both sides know where the other side's numbering starts. TCP therefore sets up a connection before any data flows, much as a phone call starts by confirming that both sides can hear each other:

```
1. Client → Server: SYN, seq=x
   "Let us connect. My numbering starts at x."
2. Server → Client: SYN+ACK, seq=y, ack=x+1
   "Received your number. Mine starts at y."
3. Client → Server: ACK, ack=y+1
   "Received yours."
```

Only after these three messages can the HTTP request be sent, so every new connection costs one round trip of delay.

A connection is identified by four values: **(local IP, local port, remote IP, remote port)**. Several browser tabs connected to the same server do not mix their data because each uses a different local port.

TCP also performs **flow control**, sending only as much as the receiver can absorb, and **congestion control**, slowing down when the network is congested.

<div class="explainer" data-explainer="dev-tcp"></div>

### UDP

**UDP** omits all of this. It attaches port numbers and sends immediately: no handshake, no ACKs, no retransmission, no ordering. In exchange it has less delay. It suits real-time voice and video calls, online games, live streaming, and DNS lookups. A video frame that arrives half a second late is useless, so discarding it is better than waiting for a retransmission.

## HTTPS

### The problem with plain HTTP

Plain HTTP is like a postcard: anyone handling it can read it, and can even rewrite it. The HTTP text sits inside TCP packets as is, so anyone on the same Wi-Fi network, the internet provider, or an intermediate router can read:

```
POST /login HTTP/1.1
Host: shop.com

{"id": "user1", "password": "1234"}
```

They can also **modify** the content in transit.

### HTTPS is HTTP over TLS

**HTTPS** sends ordinary HTTP messages through a **TLS** connection. The HTTP message is unchanged; TLS encrypts it just before it is handed to TCP. HTTPS uses port 443. TLS provides three guarantees, comparable to a locked box whose key only the two parties hold, which shows any tampering, and whose recipient must present identification:

1. **Confidentiality**: the content is encrypted.
2. **Integrity**: if even one bit changes in transit, the receiver detects it and discards the data.
3. **Authentication**: a **certificate** proves that the server really belongs to the domain.

### The TLS handshake

Right after the TCP connection is established (TLS 1.3):

```
1. ClientHello
   - the encryption methods the client supports
   - a public value for key exchange
2. ServerHello
   - the chosen encryption method
   - the server's public value for key exchange
   - the certificate, plus a signature made with the certificate's private key
3. Each side computes the same "session key" independently
4. All HTTP messages are then encrypted with the session key
```

- **Key exchange (ECDHE)** is a mathematical method by which two parties exchange only public values yet both compute the same secret. An eavesdropper who sees every public value still cannot compute that secret, so two strangers can agree on a shared key in full view of others.
- **Why switch to a session key.** Public-key cryptography is slow, so it is used only to agree on a key. Bulk data is encrypted with fast **symmetric encryption** (such as AES), in which the same key locks and unlocks.

### Certificates

A certificate is a document stating "this public key belongs to naver.com", digitally signed by a **certificate authority (CA)**. It is trusted for the same reason an identity card is: not because the holder made it, but because a trusted issuer did. Browsers and operating systems ship with a list of trusted CAs. The browser checks that:

- the CA signature is genuine,
- the domain in the certificate matches the domain being visited, and
- the certificate has not expired.

If any check fails, the browser shows a "Your connection is not private" warning. A fake server cannot obtain a valid certificate for the real domain, so it cannot impersonate the site or sit in the middle of the connection.

### What HTTPS does and does not hide

| Visible to an observer | Hidden |
|---|---|
| Remote IP address and port (443) | Path (`/login`) |
| The domain name being visited | Query string (`?page=2`) |
| Approximate data size and timing | Headers, cookies, body (passwords) |

An observer on a café Wi-Fi network can therefore tell that a device is connecting to `naver.com`, but cannot read the password it sends.

### The full sequence

<figure class="dev-diagram"><div data-diagram="flow"></div><figcaption>The four stages before and during an HTTPS request.</figcaption></figure>

On macOS or Linux, `curl -v https://www.google.com` prints each stage: `Connected to ...` (TCP connection), the TLS handshake and `Server certificate` details, `> GET / HTTP/2` (the request), and `< HTTP/2 200` (the response).

## Who chooses the program: the operating system

Suppose one server runs both a web server (port 443) and MySQL (port 3306). When a packet arrives, the choice of program is made at the **TCP layer** by reading the **destination port** in the TCP header. The component that makes this choice is the **operating system**, not a web server such as nginx. A building's mailroom offers a comparison: it reads the unit number and drops each letter in the right resident's box.

1. When a program starts, it asks the operating system to deliver everything arriving on a given port to it. This is called **listening** on, or **binding** to, the port.
   - nginx listens on 443
   - MySQL listens on 3306
   - a Spring application listens on 8080
2. When a packet arrives, the TCP code inside the operating system kernel reads the destination port and hands the data to the program listening on it.
3. Only one program can listen on a given port. Starting a second Spring application on the same port fails with **"Port 8080 was already in use"**, an error that appears often in practice.

A packet for port 3306 therefore goes straight from the operating system to MySQL without touching nginx.

### What nginx does: routing at the HTTP layer

nginx is itself **just another program, listening on port 443**. What distinguishes it is that it reads the HTTP request and **forwards it to another program**. This role is called a **reverse proxy**, comparable to a reception desk: visitors enter through one main door, and the desk sends each one to the right department.

<figure class="dev-diagram"><div data-diagram="nginx"></div><figcaption>The operating system picks nginx by port 443; nginx then picks a backend by reading the HTTP path.</figcaption></figure>

nginx decides using the **HTTP content** (path, `Host` header), not the port. It commonly handles TLS as well, so the Spring application behind it receives plain HTTP.

| Who | Layer | Reads | Decides |
|---|---|---|---|
| Router | IP | Destination IP | Which computer |
| Operating system | TCP | Destination port | Which program on that computer |
| nginx | HTTP | Path, Host | Which backend application |

For a request to `https://shop.com/api/posts/3` with nginx on 443 and Spring on 8080, the operating system is involved **twice**:

1. The packet arrives; the OS sees port 443 and hands it to nginx.
2. nginx reads the HTTP request: the path starts with `/api/`, so Spring is responsible.
3. nginx sends a **new** HTTP request to `localhost:8080` over a new TCP connection.
4. The OS sees port 8080 and hands it to Spring.
5. Spring runs and responds; the response travels Spring → nginx → user.

nginx does not let the original request pass through. It becomes a client itself and makes a second request to Spring. That behavior is what defines a proxy.

## Forward and reverse proxies

**Proxy** means "agent" or "stand-in". A proxy stands between a client and a server, receives a request from one side, **makes a new request in its own name** to the other side, and returns the result. The other side meets only the proxy, never the original party. Proxies split into two kinds depending on whom they act for.

### Forward proxy: acting for clients

<figure class="dev-diagram"><div data-diagram="forward"></div><figcaption>A forward proxy acts for clients. Internet servers see only the proxy's address, so the individual clients are hidden.</figcaption></figure>

- It sits on the **client side**, for example at a company or school network exit, and all outbound requests go through it.
- Servers see requests arriving from the **proxy's IP address**. **The client is hidden.**
- Uses: blocking sites, logging access, caching frequently downloaded files.

### Reverse proxy: acting for servers

<figure class="dev-diagram"><div data-diagram="reverse"></div><figcaption>A reverse proxy acts for servers. Users see only shop.com:443, so the servers behind nginx are hidden.</figcaption></figure>

- It sits on the **server side**. Users see only nginx and cannot tell how many Spring servers exist or on which ports. **The servers are hidden.**
- Its direction is the **reverse** of a forward proxy: it receives requests on behalf of servers rather than sending them on behalf of clients.
- Uses:
  - **TLS termination**: nginx handles encryption, and Spring behind it handles plain HTTP.
  - **Routing by path**: `/api` to Spring, `/images` to files.
  - **Load balancing**: distributing requests across several identical Spring servers.
  - **Security**: the application server (port 8080) is never exposed directly to the internet.

| | Forward proxy | Reverse proxy |
|---|---|---|
| Acts for | Clients | Servers |
| Location | Client network exit | Service entrance |
| Hidden side | Clients | Servers |
| Example | Company proxy | nginx, AWS ALB |

In one sentence: a forward proxy **sends requests on behalf of clients** and hides the clients; a reverse proxy **receives requests on behalf of servers** and hides the servers. The mechanical action is identical; what differs is who deploys the proxy and whom it serves.

<div class="explainer" data-explainer="dev-proxy"></div>
