self.onmessage = function(e) {
    const msg = e.data;

    // 1. Extract properties flexibly to match threads.js
    // threads.js might send 'command' (new way) or 'type' (old way)
    const operation = msg.command || msg.type;
    
    // threads.js might send 'code' (new way) or 'mapperCode' (old way)
    const functionBody = msg.code || msg.mapperCode;
    
    // threads.js sends 'args' (e.g. ['x']), defaults to ['item'] if missing
    const paramNames = msg.args || ['item'];
    
    const data = msg.data;

    try {
        if (operation === 'map') {
            // 2. Create the function dynamically with the correct parameter name
            // equivalent to: new Function('x', 'return x + 5;')
            const mapper = new Function(...paramNames, functionBody);

            // 3. Execute the map
            const result = data.map(item => mapper(item));

            // 4. Send back success
            self.postMessage({ result: result });
        }
        else if (operation === 'reduce') {
             // Logic for reduce if you implement it later
             const reducer = new Function(paramNames[0], paramNames[1], functionBody);
             // ... reduce logic
        }
    } catch (error) {
        // 5. Send back errors so Snap! doesn't just hang on "undefined"
        self.postMessage({ error: error.toString() });
    }
};