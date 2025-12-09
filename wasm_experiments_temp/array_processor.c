/*
My command (after installing emcc):

>> ~|pSnap\wasm_experiments_temp> emcc array_processor.c -o pthreads_test.html `
>>     -O3 `
>>     -s USE_PTHREADS=1 `
>>     -s PTHREAD_POOL_SIZE=4 `
>>     -s ALLOW_MEMORY_GROWTH=1 `
>>     -s EXPORTED_FUNCTIONS=['_wasm_run_pthreads_test']
emcc: warning: -pthread + ALLOW_MEMORY_GROWTH may run non-wasm code slowly, see https://github.com/WebAssembly/design/issues/1271 [-Wpthreads-mem-growth]

Test pThread implementation, OMP did not work, does not appear to be part of base emcc installation

*/

#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <emscripten/emscripten.h>

#define NUM_THREADS 4

typedef struct {
    int thread_id;
} thread_data_t;

// The function each thread will execute
void* wasm_thread_routine(void* arg) {
    thread_data_t* data = (thread_data_t*)arg;
    
    // We expect this function to run on a Web Worker, should land in a log
    if (data->thread_id == 0) {
        printf("Hello from a Web Worker (Pthread ID %d).\n", data->thread_id);
    } else {
        printf("Worker thread running (Pthread ID %d).\n", data->thread_id);
    }
    
    // Example work
    long long result = 0;
    for (long long i = 0; i < 100000; i++) {
        result += i;
    }

    pthread_exit(NULL);
    return NULL;
}


EMSCRIPTEN_KEEPALIVE
int wasm_run_pthreads_test() {
    pthread_t threads[NUM_THREADS];
    thread_data_t thread_data[NUM_THREADS];
    int rc;

    printf("Attempting to create %d pthreads (Web Workers)...\n", NUM_THREADS);

    for (int i = 0; i < NUM_THREADS; i++) {
        thread_data[i].thread_id = i;
        
        // pthread_create() is handled by Emscripten's pthreads implementation
        rc = pthread_create(&threads[i], NULL, wasm_thread_routine, (void*)&thread_data[i]);

        if (rc) {
            fprintf(stderr, "Error: unable to create thread %d, code: %d\n", i, rc);
            return 0; // Failure
        }
    }

    for (int i = 0; i < NUM_THREADS; i++) {
        pthread_join(threads[i], NULL);
    }

    printf("All threads joined successfully. Pthreads test complete.\n");
    return 1; // Success
}

int main() {
    return 0;
}