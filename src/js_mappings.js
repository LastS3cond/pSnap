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
    ReporterBlockMorph.prototype.transpileForWorker = function (paramNames = ['item'], sharedList = []) {
        slotIndex = 0; 
        return this.transpileReporter(paramNames, sharedList);
    };
    
    // NEW: Command Block Entry Point
    CommandBlockMorph.prototype.transpileForWorker = function (paramNames = [], sharedList = []) {
        slotIndex = 0;
        let code = this.transpileCommand(paramNames, sharedList);
        if (this.nextBlock()) {
            code += ';\n' + this.nextBlock().transpileForWorker(paramNames, sharedList);
        }
        return code;
    };

    BlockMorph.prototype.transpileForWorker = function () { return 'item'; };

    function getAllBlocks(block) {
        let cur = block;
        const blocks = [cur];
        while (cur.nextBlock()) {
            cur = cur.nextBlock();
            blocks.push(cur);
        }
        return blocks;
    }

    // NEW: Command Transpiler Logic
    CommandBlockMorph.prototype.transpileCommand = function(paramNames, sharedList = []) {
        const selector = this.selector;
        const inputs = this.inputs();

        switch (selector) {
            case 'doSetVar':
                // inputs[0] is the variable name (string), inputs[1] is value
                return `${inputs[0].evaluate()} = ${this.transpileInput(inputs[1], paramNames, sharedList)}`;
            case 'doChangeVar':
                return `${inputs[0].evaluate()} += Number(${this.transpileInput(inputs[1], paramNames, sharedList)})`;
            case 'doDeclareVariables':
                // var names are in inputs[0] (MultiArgMorph)
                const vars = inputs[0].inputs().map(slot => slot.evaluate()).join(', ');
                return `let ${vars}`;
            case 'log':
                // inputs[0] is MultiArgMorph for %mult%s
                const args = inputs[0].inputs().map(inp => this.transpileInput(inp, paramNames, sharedList)).join(', ');
                return `console.log(${args})`;
            case 'doAtomic':
                const commands = getAllBlocks(inputs[0].inputs()[0]);
                return commands.map(cmd => {
                    if (cmd.selector === 'doSetVar' || cmd.selector === 'doChangeVar')
                    {
                        const varName = cmd.inputs()[0].evaluate();
                        const input = this.transpileInput(cmd.inputs()[1], paramNames, sharedList);

                        if (sharedList.includes(varName))
                        {
                            if (cmd.selector === 'doSetVar') {
                                return `Atomics.store(shared["${varName}"], 0, Number(${input}))`;
                            } else if (cmd.selector === 'doChangeVar') {
                                return `Atomics.add(shared["${varName}"], 0, Number(${input}))`;
                            }
                        }
                    }
                    return cmd.transpileCommand(paramNames, sharedList);
                }).join(';\n');
            default:
                return `// Unsupported command: ${selector}`;
        }
    };

    // C. Main Logic
    ReporterBlockMorph.prototype.transpileReporter = function (paramNames, sharedList = []) {
        const selector = this.selector;
        const inputs = this.inputs();

        if (CODE_TEMPLATES[selector]) {
            let code = CODE_TEMPLATES[selector];
            for (let i = 0; i < inputs.length; i++) {
                code = code.replace(new RegExp(`<#${i + 1}>`, 'g'), this.transpileInput(inputs[i], paramNames, sharedList));
            }
            return code;
        }

        switch (selector) {
            case 'reportGetVar':
                // Handle variable retrieval
                const varName = this.blockSpec;
                if (sharedList.includes(varName)) {
                    return `Atomics.load(shared["${varName}"], 0)`;
                }
                return varName;
            case 'reportVariadicSum': return this.transpileVariadic(inputs, paramNames, sharedList, '+', '0', false, true);
            case 'reportVariadicProduct': return this.transpileVariadic(inputs, paramNames, sharedList, '*', '1', false, true);
            case 'reportVariadicMax': return this.transpileMathFunction(inputs, paramNames, sharedList, 'Math.max', '-Infinity');
            case 'reportVariadicMin': return this.transpileMathFunction(inputs, paramNames, sharedList, 'Math.min', 'Infinity');
            case 'reportVariadicAnd': return this.transpileVariadic(inputs, paramNames, sharedList, '&&', 'true');
            case 'reportVariadicOr': return this.transpileVariadic(inputs, paramNames, sharedList, '||', 'false');
            case 'reportJoinWords': return this.transpileVariadic(inputs, paramNames, sharedList, '+', '""', true);
            case 'reportMonadic': return this.transpileMonadic(inputs, paramNames, sharedList);
            case 'reportGetWorkerId': return 'WORKER_ID';
            default: return 'item'; 
        }
    };

    ReporterBlockMorph.prototype.transpileVariadic = function(inputs, paramNames, sharedList = [], op, identity, forceString=false, forceNumber=false) {
        let args = this.extractArgs(inputs, paramNames, sharedList);
        if (args.length === 0) return identity;
        if (forceString) args = args.map(a => `String(${a})`);
        else if (forceNumber) args = args.map(a => `Number(${a})`);
        return `(${args.join(` ${op} `)})`;
    };

    ReporterBlockMorph.prototype.transpileMathFunction = function(inputs, paramNames, sharedList = [], func, identity) {
        let args = this.extractArgs(inputs, paramNames, sharedList);
        if (args.length === 0) return identity;
        args = args.map(a => `Number(${a})`);
        return `${func}(${args.join(', ')})`;
    };

    ReporterBlockMorph.prototype.extractArgs = function(inputs, paramNames, sharedList = []) {
        if (inputs.length > 0 && inputs[0] instanceof MultiArgMorph) {
            return inputs[0].inputs().map(inp => this.transpileInput(inp, paramNames, sharedList));
        }
        return inputs.map(inp => this.transpileInput(inp, paramNames, sharedList));
    };

    ReporterBlockMorph.prototype.transpileMonadic = function (inputs, paramNames, sharedList = []) {
        let op = inputs[0].evaluate();
        if (Array.isArray(op)) op = op[0];
        const val = this.transpileInput(inputs[1], paramNames, sharedList);
        const jsFunc = MONADIC_MATH_MAP[op];
        return jsFunc ? `${jsFunc}(${val})` : val;
    };

    ReporterBlockMorph.prototype.transpileInput = function (input, paramNames, sharedList = []) {
        if (!input) return 'undefined';
        if (input instanceof ReporterBlockMorph) return input.transpileReporter(paramNames, sharedList);
        if (input instanceof CommandBlockMorph) return input.transpileForWorker(paramNames, sharedList); // Handle nested commands if any
        
        if (input instanceof InputSlotMorph) {
            // FIX: If slot is empty, pick the NEXT parameter, not always the first one
            if (input.contents().text === '') {
                const param = paramNames[slotIndex % paramNames.length];
                slotIndex++; 
                return param;
            }
            const val = input.evaluate();
            // Quote strings that aren't numbers to ensure valid JS syntax
            return isNaN(Number(val)) ? `"${val}"` : val;
        }
        return 'item';
    };

    CommandBlockMorph.prototype.transpileInput = ReporterBlockMorph.prototype.transpileInput;
})();