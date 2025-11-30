   (function () {
    if (typeof ReporterBlockMorph === 'undefined') return;

    const CODE_TEMPLATES = {
        reportSum:        '(Number(<#1>) + Number(<#2>))', 
        reportDifference: '(Number(<#1>) - Number(<#2>))',
        reportProduct:    '(Number(<#1>) * Number(<#2>))',
        reportQuotient:   '(Number(<#1>) / Number(<#2>))',
        reportModulus:    '(Number(<#1>) % Number(<#2>))',
        reportPower:      'Math.pow(Number(<#1>), Number(<#2>))',
        reportRound:      'Math.round(Number(<#1>))',
        reportMax:        'Math.max(Number(<#1>), Number(<#2>))',
        reportMin:        'Math.min(Number(<#1>), Number(<#2>))',
        reportLessThan:    '(Number(<#1>) < Number(<#2>))',
        reportGreaterThan: '(Number(<#1>) > Number(<#2>))',
        reportEquals:      '(<#1> == <#2>)',
        reportAnd: '(<#1> && <#2>)',
        reportOr:  '(<#1> || <#2>)',
        reportNot: '(!(<#1>))',
        reportJoinWords: '("" + <#1> + <#2>)',
        reportListLength: '(<#1>).length'
    };

    const MONADIC_MATH_MAP = {
        'abs': 'Math.abs', 'neg': '-', 'sign': 'Math.sign',
        'ceiling': 'Math.ceil', 'floor': 'Math.floor', 'sqrt': 'Math.sqrt',
        'sin': 'Math.sin', 'cos': 'Math.cos', 'tan': 'Math.tan',
        'asin': 'Math.asin', 'acos': 'Math.acos', 'atan': 'Math.atan',
        'ln': 'Math.log', 'log': 'Math.log10', 'lg': 'Math.log2',
        'e^': 'Math.exp', '10^': '10^', '2^': '2^', 'id': ''
    };

    // --- NEW: Slot Counter ---
    let slotIndex = 0;

    // B. Entry Point
    ReporterBlockMorph.prototype.transpileForWorker = function (paramNames = ['item']) {
        slotIndex = 0; 
        return this.transpileReporter(paramNames);
    };
    BlockMorph.prototype.transpileForWorker = function () { return 'item'; };

    // C. Main Logic
    ReporterBlockMorph.prototype.transpileReporter = function (paramNames) {
        const selector = this.selector;
        const inputs = this.inputs();

        if (CODE_TEMPLATES[selector]) {
            let code = CODE_TEMPLATES[selector];
            for (let i = 0; i < inputs.length; i++) {
                code = code.replace(new RegExp(`<#${i + 1}>`, 'g'), this.transpileInput(inputs[i], paramNames));
            }
            return code;
        }

        switch (selector) {
            case 'reportVariadicSum': return this.transpileVariadic(inputs, paramNames, '+', '0', false, true);
            case 'reportVariadicProduct': return this.transpileVariadic(inputs, paramNames, '*', '1', false, true);
            case 'reportVariadicMax': return this.transpileMathFunction(inputs, paramNames, 'Math.max', '-Infinity');
            case 'reportVariadicMin': return this.transpileMathFunction(inputs, paramNames, 'Math.min', 'Infinity');
            case 'reportVariadicAnd': return this.transpileVariadic(inputs, paramNames, '&&', 'true');
            case 'reportVariadicOr': return this.transpileVariadic(inputs, paramNames, '||', 'false');
            case 'reportJoinWords': return this.transpileVariadic(inputs, paramNames, '+', '""', true);
            case 'reportMonadic': return this.transpileMonadic(inputs, paramNames);
            default: return 'item'; 
        }
    };

    ReporterBlockMorph.prototype.transpileVariadic = function(inputs, paramNames, op, identity, forceString=false, forceNumber=false) {
        let args = this.extractArgs(inputs, paramNames);
        if (args.length === 0) return identity;
        if (forceString) args = args.map(a => `String(${a})`);
        else if (forceNumber) args = args.map(a => `Number(${a})`);
        return `(${args.join(` ${op} `)})`;
    };

    ReporterBlockMorph.prototype.transpileMathFunction = function(inputs, paramNames, func, identity) {
        let args = this.extractArgs(inputs, paramNames);
        if (args.length === 0) return identity;
        args = args.map(a => `Number(${a})`);
        return `${func}(${args.join(', ')})`;
    };

    ReporterBlockMorph.prototype.extractArgs = function(inputs, paramNames) {
        if (inputs.length > 0 && inputs[0] instanceof MultiArgMorph) {
            return inputs[0].inputs().map(inp => this.transpileInput(inp, paramNames));
        }
        return inputs.map(inp => this.transpileInput(inp, paramNames));
    };

    ReporterBlockMorph.prototype.transpileMonadic = function (inputs, paramNames) {
        let op = inputs[0].evaluate();
        if (Array.isArray(op)) op = op[0];
        const val = this.transpileInput(inputs[1], paramNames);
        const jsFunc = MONADIC_MATH_MAP[op];
        return jsFunc ? `${jsFunc}(${val})` : val;
    };

    ReporterBlockMorph.prototype.transpileInput = function (input, paramNames) {
        if (!input) return 'undefined';
        if (input instanceof ReporterBlockMorph) return input.transpileReporter(paramNames);
        
        if (input instanceof InputSlotMorph) {
            // FIX: If slot is empty, pick the NEXT parameter, not always the first one
            if (input.contents().text === '') {
                const param = paramNames[slotIndex % paramNames.length];
                slotIndex++; 
                return param;
            }
            return input.evaluate().toString();
        }
        return 'item';
    };
})();