---
title: "Development Study Day 1: How a Web Request Travels"
date: "2026-11-24"
category: "Development"
series: "Development Study"
part: 1
description: "What a backend does, the anatomy of HTTP requests and URLs, DNS and ports, TCP and HTTPS, how one request passes through four network layers, and forward versus reverse proxies."
draft: false
---

## What a backend does

Every web or app interaction has three parts.

- The **client** is the program the user touches: a browser or a mobile app. It sends requests and draws the results on screen. The screen-drawing part is the **frontend**.
- The **server** receives those requests, applies the rules of the service, and returns a response. This is the **backend**.
- The **database (DB)** stores the data the server needs.

Opening a social media feed, for example, works like this:

1. The app sends a **request** to the server: "show this user's feed".
2. The server checks whether the user is logged in and whom they follow, then reads the relevant posts from the database.
3. The server packages the result and returns it as a **response**.
4. The app renders the data on screen.

A backend developer's work therefore falls into three parts: receive requests, apply the rules (authentication, calculations, permissions), and store or read data to build a response. The format the client and server agree on for those requests and responses is HTTP.

## HTTP requests and responses

HTTP messages are plain text with a fixed layout.

### The request

```
GET /posts/3 HTTP/1.1
Host: myblog.com
Accept: application/json
```

- The first line holds the **method** (what to do), the **path** (on what), and the HTTP version.
- The lines below are **headers**: additional information, such as "respond in JSON".
- An optional **body** follows a blank line and carries data, such as the text of a new post.

### Methods

| Method | Meaning | Example |
|---|---|---|
| GET | Read | Show post 3 |
| POST | Create | Write a new post |
| PUT / PATCH | Update | Edit post 3 |
| DELETE | Delete | Delete post 3 |

Creating a post therefore looks like this:

```
POST /posts HTTP/1.1
Host: myblog.com
Content-Type: application/json

{"title": "First post", "content": "Hello"}
```

Everything below the blank line is the body. The `{ }` format is **JSON**, the most common format for data exchanged by backends.

### The response

```
HTTP/1.1 200 OK
Content-Type: application/json

{"id": 3, "title": "First post", "content": "Hello"}
```

The number on the first line is the **status code**, the server's summary of what happened.

- **2xx, success**: 200 OK, 201 Created.
- **4xx, the client's mistake**: 400 malformed request, 401 log in first, 404 no such resource.
- **5xx, the server's mistake**: 500 internal server error.

In Spring, a backend developer writes rules of the form: "when `GET /posts/3` arrives, read post 3 from the database and return it as JSON with status 200."

The browser's developer tools show these messages directly: press F12 (Cmd+Option+I on macOS), open the **Network** tab, reload the page, and select any row to see its **Request Method** and **Status Code**.

### Deleting the same thing twice

Deleting a comment sends a `DELETE` request. If the comment has already been deleted, a second `DELETE` commonly returns **404 Not Found**, because the resource no longer exists. Some services instead return **204 No Content**, reasoning that the desired end state (the comment is gone) already holds. Both conventions are used; choosing between them is an API design decision made by the backend developer.

## URLs, DNS, IP addresses, and ports

An HTTP message needs a destination. Four concepts determine where it goes.

### The parts of a URL

```
https://www.naver.com:443/news/list?page=2
```

- `https` is the **protocol**: the rules of the conversation. HTTPS is the encrypted form of HTTP.
- `www.naver.com` is the **host**, written as a domain name.
- `:443` is the **port**, usually omitted.
- `/news/list` is the **path**: which resource on that host.
- `?page=2` is the **query string**: additional options.

Two points are easy to confuse. First, in `http://localhost:8080/posts/3`, `localhost` is the **host**, not the path; it means "this computer itself". The path begins at the first `/` after the host, so it is `/posts/3`, written with the leading slash. Second, when the port is omitted the browser uses the protocol's default: **80 for http and 443 for https**.

Typing an address into the browser's address bar and pressing Enter always sends a **GET** request. The address bar can only ask to read. POST is sent when a page or app submits data, for example a sign-up form or a "publish" button. Testing a POST API therefore requires a tool such as Postman or curl rather than the address bar.

<div class="explainer" data-explainer="dev-url"></div>

### IP addresses

Computers do not locate each other by names such as `www.naver.com`. They use numeric **IP addresses** such as `223.130.200.104`, the actual network address of a machine.

### DNS

Something must translate names into addresses. That is **DNS** (Domain Name System), effectively the internet's phone book:

> Browser: "What is the address of naver.com?"  DNS: "223.130.200.104."

DNS only translates. A client that already knows the IP address can connect without DNS, so the site remains reachable by IP even when DNS fails. (Large sites sometimes refuse direct IP access for security and certificate reasons, but the principle holds.)

### Ports

One server machine can run several programs. The IP address identifies the machine; the **port** identifies the program on it.

- 80: HTTP
- 443: HTTPS
- 3306: MySQL
- 8080: the default port of a Spring Boot application. During development the address `localhost:8080` appears constantly.

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

The packet that leaves the machine is nested:

```
┌ IP header (which computer) ──────────────────────┐
│ ┌ TCP header (which program, which byte) ──────┐ │
│ │ ┌ TLS (encrypted) ────────────────────────┐ │ │
│ │ │  GET /posts/3 HTTP/1.1  Host: shop.com  │ │ │
│ │ └─────────────────────────────────────────┘ │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**Routers** along the way read only the outermost IP header and forward the packet toward the destination address. They do not open the inner layers, and because of TLS they could not read them anyway.

On the server, the layers are removed in reverse order:

- **IP** confirms that the destination address is its own and removes the IP header.
- **TCP** sees port 443, reorders the bytes by sequence number, sends an acknowledgement, and hands the data to the program on port 443.
- **TLS** decrypts the data with the session key and recovers the original HTTP text.
- **HTTP**: the server reads `GET /posts/3`. Application code, such as a Spring controller, starts here.

The response travels the same way in the opposite direction.

<div class="explainer" data-explainer="dev-layers"></div>

### Why layers

Because each layer reads only its own header, layers do not need to know about each other. HTTP does not care whether the bytes travel over Wi-Fi or LTE; IP does not care whether the payload is a web page or game data. TCP can be swapped for UDP, or HTTP for another protocol, without changing the other layers.

Spring operates at the HTTP layer. The operating system and the web server software (for example Tomcat) handle TCP, TLS, and IP, and application code receives an already unwrapped `GET /posts/3`. The lower layers still matter for diagnosing slow connections, certificate errors, and similar problems.

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

```
1. DNS lookup: naver.com → IP address
2. TCP three-way handshake with port 443 at that address
3. TLS handshake: certificate check and session key agreement
4. Encrypted HTTP request and response
```

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

```
Internet ──443──▶ [OS] ──▶ nginx
                            │ reads the HTTP request
                            ├─ /api/...    ──▶ Spring app (localhost:8080)
                            └─ /images/... ──▶ image files on disk
```

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

```
[Employee PC] ──▶ [Forward proxy] ──▶ any server on the internet
                  (company network exit)
```

- It sits on the **client side**, for example at a company or school network exit, and all outbound requests go through it.
- Servers see requests arriving from the **proxy's IP address**. **The client is hidden.**
- Uses: blocking sites, logging access, caching frequently downloaded files.
- The word "proxy" on its own usually refers to this kind; it is the original concept.

### Reverse proxy: acting for servers

```
Users on the internet ──▶ [Reverse proxy (nginx)] ──▶ Spring servers
                          (service entrance)
```

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

In one sentence: a forward proxy **sends requests on behalf of clients** and hides the clients; a reverse proxy **receives requests on behalf of servers** and hides the servers. Both perform the same mechanical action of receiving a request and re-issuing it. The difference is who deploys the proxy and whom it serves: a company placing it at its employees' exit makes it a forward proxy; a service operator placing it in front of its own servers makes it a reverse proxy.

<div class="explainer" data-explainer="dev-proxy"></div>
