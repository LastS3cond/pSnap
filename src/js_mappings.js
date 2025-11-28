(function () {
    if (typeof ReporterBlockMorph === 'undefined') return;

    // A. Templates
    const CODE_TEMPLATES = {
        // Force Number() on simple sum to prevent "1" + 5 = "15"
        reportSum:        '(Number(<#1>) + Number(<#2>))', 
        reportDifference: '(<#1> - <#2>)',
        reportProduct:    '(<#1> * <#2>)',
        reportQuotient:   '(<#1> / <#2>)',
        reportModulus:    '(<#1> % <#2>)',
        reportPower:      'Math.pow(<#1>, <#2>)',
        reportRound:      'Math.round(<#1>)',
        reportEquals:      '(<#1> === <#2>)',
        reportLessThan:    '(<#1> < <#2>)',
        reportGreaterThan: '(<#1> > <#2>)',
        reportAnd: '(<#1> && <#2>)',
        reportOr:  '(<#1> || <#2>)',
        reportNot: '(!(<#1>))',
        reportListLength: '(<#1>).length',
        reportListContainsItem: '(<#1>).includes(<#2>)', 
        reportStringSize: 'String(<#1>).length',
        reportIfElse: '((<#1>) ? (<#2>) : (<#3>))'
    };

    const MONADIC_MATH_MAP = {
        'abs': 'Math.abs', 'neg': '-', 'sign': 'Math.sign',
        'ceiling': 'Math.ceil', 'floor': 'Math.floor', 'sqrt': 'Math.sqrt',
        'sin': 'Math.sin', 'cos': 'Math.cos', 'tan': 'Math.tan',
        'asin': 'Math.asin', 'acos': 'Math.acos', 'atan': 'Math.atan',
        'ln': 'Math.log', 'log': 'Math.log10', 'lg': 'Math.log2',
        'e^': 'Math.exp', '10^': '10^', '2^': '2^', 'id': ''
    };

    // B. Entry Point
    ReporterBlockMorph.prototype.transpileForWorker = function (paramNames = ['item']) {
        console.log("Transpiler: Starting compilation for", this.selector);
        const code = this.transpileReporter(paramNames);
        console.log("Transpiler: Result ->", code);
        return code;
    };

    BlockMorph.prototype.transpileForWorker = function () { return 'item'; };

    // C. Main Switch Logic
    ReporterBlockMorph.prototype.transpileReporter = function (paramNames = ['item']) {
        const selector = this.selector;
        const inputs = this.inputs();

        if (CODE_TEMPLATES[selector]) {
            let code = CODE_TEMPLATES[selector];
            for (let i = 0; i < inputs.length; i++) {
                const val = this.transpileInput(inputs[i], paramNames);
                code = code.replace(new RegExp(`<#${i + 1}>`, 'g'), val);
            }
            return code;
        }

        switch (selector) {
            // --- VARIADIC FIXES ---
            case 'reportVariadicSum':
                // Force Number casting (last argument = true)
                return this.transpileVariadic(inputs, paramNames, '+', '0', false, true);
            
            case 'reportVariadicProduct':
                return this.transpileVariadic(inputs, paramNames, '*', '1');
            case 'reportVariadicAnd':
                return this.transpileVariadic(inputs, paramNames, '&&', 'true');
            case 'reportVariadicOr':
                return this.transpileVariadic(inputs, paramNames, '||', 'false');
            case 'reportJoinWords': 
                return this.transpileVariadic(inputs, paramNames, '+', '""', true);

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
            case 'reportLetter':
                const letterIdx = this.transpileInput(inputs[0], paramNames);
                const str = this.transpileInput(inputs[1], paramNames);
                return `String(${str})[(${letterIdx}) - 1]`;
            case 'reportTextFunction': 
                return this.transpileTextFunction(inputs, paramNames);
            case 'reportGetVar':
                const varName = this.blockSpec;
                return paramNames.includes(varName) ? varName : `"${varName}"`;
            case 'reifyReporter':
            case 'reifyPredicate':
                return inputs.length > 0 ? this.transpileInput(inputs[0], paramNames) : 'item';
            default:
                console.warn('Snap! Transpiler: Unknown selector', selector);
                return 'item'; 
        }
    };

    // D. Helper Logic

    ReporterBlockMorph.prototype.transpileVariadic = function(inputs, paramNames, operator, identity, forceString=false, forceNumber=false) {
        let args = [];
        if (inputs.length > 0 && inputs[0] instanceof MultiArgMorph) {
            args = inputs[0].inputs().map(inp => this.transpileInput(inp, paramNames));
        } else {
            args = inputs.map(inp => this.transpileInput(inp, paramNames));
        }

        if (args.length === 0) return identity;

        if (forceString) {
            args = args.map(a => `String(${a})`);
        } else if (forceNumber) {
            // Fix for "1" + 5 = "15"
            args = args.map(a => `Number(${a})`);
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
        if (!jsFunc) return val;
        if (opName === 'neg') return `(-(${val}))`;
        if (opName === '10^') return `Math.pow(10, ${val})`;
        if (opName === '2^')  return `Math.pow(2, ${val})`;
        return `${jsFunc}(${val})`;
    };

    ReporterBlockMorph.prototype.transpileTextFunction = function (inputs, paramNames) {
        const funcSlot = inputs[0];
        const textSlot = inputs[1];
        let funcName = 'length';
        if (funcSlot instanceof InputSlotMorph) {
            const evalResult = funcSlot.evaluate();
            funcName = (Array.isArray(evalResult) ? evalResult[0] : evalResult);
        }
        const text = this.transpileInput(textSlot, paramNames);
        switch (funcName) {
            case 'lower case': return `String(${text}).toLowerCase()`;
            case 'upper case': return `String(${text}).toUpperCase()`;
            default: return `String(${text}).length`;
        }
    };

    ReporterBlockMorph.prototype.transpileInput = function (input, paramNames) {
        if (!input) return 'undefined';
        if (input instanceof ReporterBlockMorph) {
            return input.transpileReporter(paramNames);
        }
        if (input instanceof InputSlotMorph) {
            if (input.contents().text === '') return paramNames[0]; 
            const value = input.evaluate();
            if (typeof value === 'string') return JSON.stringify(value);
            return String(value);
        }
        if (input instanceof TemplateSlotMorph) {
            const varName = input.contents();
            return paramNames.includes(varName) ? varName : `"${varName}"`;
        }
        if (input instanceof BooleanSlotMorph) return String(input.evaluate());
        if (input instanceof MultiArgMorph) {
            if (input.inputs().length > 0) return this.transpileInput(input.inputs()[0], paramNames);
        }
        return 'item';
    };
})();