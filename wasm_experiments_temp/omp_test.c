#include <stdio.h>
#include <omp.h>
#include <emscripten/emscripten.h>

// Test file to detect OMP within emcc
EMSCRIPTEN_KEEPALIVE
int check_omp_threads() {
    int num_procs = 0;
    #ifdef _OPENMP
        // OpenMP is detected at compile time
        printf("OpenMP version: %d\n", _OPENMP);
        num_procs = omp_get_max_threads();
        printf("Max OpenMP Threads: %d\n", num_procs);

        // Simple parallel region test
        #pragma omp parallel
        {
            if (omp_get_thread_num() == 0) {
                printf("Hello from main thread (0) in a parallel region.\n");
            }
        }

    #else
        // OpenMP is not detected at compile time
        printf("OpenMP not supported/enabled during compilation.\n");
    #endif

    return num_procs > 1; // Return 1 if multi-threading is enabled
}

int main() {

    return 0;
}