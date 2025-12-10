#include <math.h>
#include <limits.h>
#include <pthread.h>
#include <emscripten/emscripten.h>
#include <stdio.h>

#define NUM_THREADS 4

typedef struct {
    double* arr;
    int start_index;
    int end_index;
    double parameter;
    int operation; 
} thread_task_t;

typedef enum {
    OP_MULTIPLY_CONSTANT = 2,
    OP_ADD_CONSTANT = 1,
    OP_UNSUPPORTED = 0
} ArrayOperationCode;


void* array_processing_routine(void* arg) {
    thread_task_t* task = (thread_task_t*)arg;
    
    switch (task->operation) {
        case OP_ADD_CONSTANT:
            for (int i = task->start_index; i < task->end_index; i++) {
                task->arr[i] += task->parameter;
            }
            break;
        case OP_MULTIPLY_CONSTANT:
            for (int i = task->start_index; i < task->end_index; i++) {
                task->arr[i] *= task->parameter;
            }
            break;
    }
    pthread_exit(NULL);
    return NULL;
}

EMSCRIPTEN_KEEPALIVE
void print_array(double* arr, int length) {
    printf("C Result: [ ");
    for(int i=0; i<length; i++) {
        printf("%.2f ", arr[i]);
    }
    printf("]\n");
}

EMSCRIPTEN_KEEPALIVE
double wasm_process_array(int operation_code, double* arr_ptr, int length, double parameter) {
    if (length < 0) return NAN;

    ArrayOperationCode op = (ArrayOperationCode) operation_code;
    if (op == OP_UNSUPPORTED) return NAN;

    int chunk_size = length / NUM_THREADS;
    int remainder = length % NUM_THREADS;

    pthread_t threads[NUM_THREADS];
    thread_task_t tasks[NUM_THREADS];
    
    int current_index = 0;

    printf("Starting parallel array processing with %d workers...\n", NUM_THREADS);

    for (int i = 0; i < NUM_THREADS; i++) {
        tasks[i].arr = arr_ptr;
        tasks[i].start_index = current_index;
        tasks[i].parameter = parameter;
        tasks[i].operation = op;

        int size = chunk_size + (i == NUM_THREADS - 1 ? remainder : 0);
        tasks[i].end_index = tasks[i].start_index + size;

        current_index = tasks[i].end_index;

        if (tasks[i].start_index >= tasks[i].end_index) {
            threads[i] = 0;
            continue;
        }

        int rc = pthread_create(&threads[i], NULL, array_processing_routine, (void*)&tasks[i]);
        if (rc) {
            printf("Error creating thread %d: %d\n", i, rc);
            return NAN; 
        }
    }

    for (int i = 0; i < NUM_THREADS; i++) {
        if (threads[i] != 0) {
            pthread_join(threads[i], NULL);
        }
    }

    printf("All parallel array operations complete.\n");
    return 1.0; 
}

int main() {
    printf("C Main function executed. WASM module ready for JavaScript calls.\n");
    return 0;
}