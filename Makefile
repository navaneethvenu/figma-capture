all: capture.js

capture.js:
	curl -o capture.js 'https://mcp.figma.com/mcp/html-to-design/capture.js'
	node patch-capture.mjs capture.js

clean:
	rm -f capture.js

.PHONY: all clean
