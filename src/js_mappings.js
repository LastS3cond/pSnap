/* ========================================================================
   SNAP! PARALLEL MAPPER & TRANSPILER EXTENSION
   Fixed with Debugging Logs & Corrected Method Names
   ======================================================================== */

   (function () {
    if (typeof ReporterBlockMorph === 'undefined') return;

    // A. Templates for simple binary/unary blocks
    const CODE_TEMPLATES = {
        // Basic Math
        reportSum:        '(<#1> + <#2>)',
        reportDifference: '(<#1> - <#2>)',
        reportProduct:    '(<#1> * <#2>)',
        reportQuotient:   '(<#1> / <#2>)',
        reportModulus:    '(<#1> % <#2>)',
        reportPower:      'Math.pow(<#1>, <#2>)',
        reportRound:      'Math.round(<#1>)',
        
        // Logic
        reportEquals:      '(<#1> === <#2>)',
        reportLessThan:    '(<#1> < <#2>)',
        reportGreaterThan: '(<#1> > <#2>)',
        reportAnd: '(<#1> && <#2>)',
        reportOr:  '(<#1> || <#2>)',
        reportNot: '(!(<#1>))',
        
        // Strings/Lists
        reportJoinWords: '("" + <#1> + <#2>)',
        reportListLength: '(<#1>).length',
    };

    const MONADIC_MATH_MAP = {
        'abs': 'Math.abs', 'neg': '-', 'sqrt': 'Math.sqrt',
        'sin': 'Math.sin', 'cos': 'Math.cos', 'tan': 'Math.tan',
        'ln': 'Math.log', 'log': 'Math.log10', 'e^': 'Math.exp', '10^': '10^'
    };

    // B. Entry Point - MUST MATCH threads.js CALL
    ReporterBlockMorph.prototype.transpileForWorker = function (paramNames = ['item']) {
        console.log("Transpiler: Starting compilation for", this.selector);
        const code = this.transpileReporter(paramNames);
        console.log("Transpiler: Result ->", code);
        return code;
    };

    // Helper for non-reporters
    BlockMorph.prototype.transpileForWorker = function () { return 'item'; };

    // C. Main Switch Logic
    ReporterBlockMorph.prototype.transpileReporter = function (paramNames = ['item']) {
        const selector = this.selector;
        const inputs = this.inputs();

        // 1. Check simple templates first
        if (CODE_TEMPLATES[selector]) {
            let code = CODE_TEMPLATES[selector];
            for (let i = 0; i < inputs.length; i++) {
                const val = this.transpileInput(inputs[i], paramNames);
                code = code.replace(new RegExp(`<#${i + 1}>`, 'g'), val);
            }
            return code;
        }

        // 2. Complex Handlers
        switch (selector) {
            // --- VARIADIC FIXES ---
            case 'reportVariadicSum':
                return this.transpileVariadic(inputs, paramNames, '+', '0');
            case 'reportVariadicProduct':
                return this.transpileVariadic(inputs, paramNames, '*', '1');
            case 'reportVariadicAnd':
                return this.transpileVariadic(inputs, paramNames, '&&', 'true');
            case 'reportVariadicOr':
                return this.transpileVariadic(inputs, paramNames, '||', 'false');
            case 'reportJoinWords': 
                return this.transpileVariadic(inputs, paramNames, '+', '""', true);

            // --- STANDARD HANDLERS ---
            case 'reportMonadic': 
                return this.transpileMonadic(inputs, paramNames);
            
            case 'reportRandom':
                const min = this.transpileInput(inputs[0], paramNames);
                const max = this.transpileInput(inputs[1], paramNames);
                return `(Math.floor(Math.random() * ((${max}) - (${min}) + 1)) + (${min}))`;
            
            case 'reportListItem':
                const idx = this.transpileInput(inputs[0], paramNames);
                const list = this.transpileInput(inputs[1], paramNames);
                return `(${list})[(${idx}) - 1]`;
            
            // --- FALLBACK ---
            default:
                console.warn('Snap! Transpiler: Unknown selector', selector);
                // Return 'item' (identity) instead of nothing to prevent undefined errors
                return 'item'; 
        }
    };

    // D. Helper Logic

    ReporterBlockMorph.prototype.transpileVariadic = function(inputs, paramNames, operator, identity, forceString=false) {
        let args = [];
        
        // Handle Snap! Variadic Arrows (MultiArgMorph)
        if (inputs.length > 0 && inputs[0] instanceof MultiArgMorph) {
            const subInputs = inputs[0].inputs();
            args = subInputs.map(inp => this.transpileInput(inp, paramNames));
        } else {
            // Handle Standard Inputs (Legacy or fixed-arg blocks)
            args = inputs.map(inp => this.transpileInput(inp, paramNames));
        }

        if (args.length === 0) return identity;

        if (forceString) {
            args = args.map(a => `String(${a})`);
        }

        return `(${args.join(` ${operator} `)})`;
    };

    ReporterBlockMorph.prototype.transpileMonadic = function (inputs, paramNames) {
        const funcSlot = inputs[0];
        const valueSlot = inputs[1];
        let opName = 'id';
        if (funcSlot instanceof InputSlotMorph) {
            const evalResult = funcSlot.evaluate();
            opName = (Array.isArray(evalResult) ? evalResult[0] : evalResult);
        }
        const val = this.transpileInput(valueSlot, paramNames);
        const jsFunc = MONADIC_MATH_MAP[opName];
        return jsFunc ? `${jsFunc}(${val})` : val;
    };

    ReporterBlockMorph.prototype.transpileInput = function (input, paramNames) {
        if (!input) return 'undefined';

        // Recursive Block
        if (input instanceof ReporterBlockMorph) {
            return input.transpileReporter(paramNames);
        }

        // Literal / Input Slot
        if (input instanceof InputSlotMorph) {
            // Implicit Parameter: Empty slot means "item"
            if (input.contents().text === '') {
                return paramNames[0]; 
            }
            const value = input.evaluate();
            if (typeof value === 'string') return JSON.stringify(value);
            return String(value);
        }

        // Variables
        if (input instanceof TemplateSlotMorph) {
            const varName = input.contents();
            return paramNames.includes(varName) ? varName : `"${varName}"`;
        }
        
        // MultiArgMorph fall-through (should be handled by parent, but safe fallback)
        if (input instanceof MultiArgMorph) {
            if (input.inputs().length > 0) return this.transpileInput(input.inputs()[0], paramNames);
        }

        return 'item';
    };
})();