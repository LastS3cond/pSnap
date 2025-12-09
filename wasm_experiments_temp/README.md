# Array Processor - WASM Compilation Guide

## How to compile

Download emsdk to compile WASM.

```bash
git clone https://github.com/emscripten-core/emsdk.git 
cd emsdk
./emsdk install latest
./emsdk_env.bat
```

Use this command to compile the wasm:

```bash
emcc array_processor.c -o array_processor.html \
    -O3 \
    -s USE_PTHREADS=1 \
    -s PTHREAD_POOL_SIZE=6 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s PROXY_TO_PTHREAD=1 \
    -s EXPORTED_FUNCTIONS="['_wasm_process_array','_main','_malloc','_free','_print_array']"
```

## How to run

```bash
emrun --browser chrome .\array_processor.html
```

Use this script in devtools to test that the functions work.

```javascript
(async function() {
    const length = 8;
    const bytes = length * 8;
    
    const ptr = await Module._malloc(bytes);
    
    await Module._wasm_process_array(1, ptr, length, 5.5);
    
    await Module._print_array(ptr, length);
    
    await Module._free(ptr);
})();
```

### Expected Output

```
array_processor.html:1 C Main function executed. WASM module ready for JavaScript calls.
array_processor.html:1 Starting parallel array processing with 4 workers...
array_processor.html:1 All parallel array operations complete.
array_processor.html:1 C Result: [ 5.50 5.50 5.50 5.50 5.50 5.50 5.50 5.50 ]
```