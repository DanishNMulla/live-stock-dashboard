A Dashboard for Live Stock Broker Clients

This project uses Node.js, WebSockets, HTML, CSS, and JavaScript to create a real-time stock broker client web dashboard.

Multiple users can log in using their email addresses, subscribe to supported stocks, and view live-updating stock prices without refreshing the page. Stock prices are simulated using a random number generator and are updated every second.

Features:
- Regular expression-based Gmail login validation
- WebSocket-based real-time stock price updates (no REST APIs)
- Search and subscribe to supported stocks
- Subscribe and unsubscribe functionality
- Mini live price trend graph for each subscribed stock
- Main live graph with option to select which stock to view
- Supports multiple users simultaneously
- Modern Glassmorphism-based user interface

Supported Assets:
Google (GOOG), Tesla (TSLA), Amazon (AMZN), Facebook (META), Nvidia (NVDA),  
Microsoft (MSFT), Apple (AAPL), Netflix (NFLX), IBM (IBM), Oracle (ORCL)

Development Environment:
Frontend: HTML, CSS, and JavaScript  
Backend: Node.js and Express  
Real-Time Communication: WebSockets  
Charting Library: Chart.js  

How to Run the Application:
1) Install dependencies by running: npm install  
2) Start the server by running: node server.js  
3) Visit http://localhost:3000 in your web browser  

Disclaimer:
This application simulates stock price data without using an actual stock market API. The architecture of the application allows for easy extension to integrate real-time market pricing and authentication systems.
