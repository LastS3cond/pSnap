import http.server
import socketserver

PORT = 8000

class COOP_COEP_Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Reddit recommends
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    print(f"Serving Snap! with WASM Threads at http://localhost:{PORT}/snap.html")
    with socketserver.TCPServer(("", PORT), COOP_COEP_Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass