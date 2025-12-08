#include <math.h>
#include <limits.h>
#include <omp.h> 

typedef enum {
    OP_MULTIPLY_CONSTANT = 2, 
    OP_ADD_CONSTANT = 1, 
    OP_UNSUPPORTED = 0
} ArrayOperationCode;


static void wasm_addConstant(double* arr, int len, double val) {
    #pragma omp parallel for
    for (int i = 0; i < len; i++) {
        arr[i] += val;
    }
}

static void wasm_multiplyConstant(double* arr, int len, double val) {
    #pragma omp parallel for
    for (int i = 0; i < len; i++) {
        arr[i] *= val;
    }
}



double wasm_process_array(int operation_code, double* arr_ptr, int length, double parameter) {
    
    if (length < 0) return NAN;
    
    ArrayOperationCode op = (ArrayOperationCode) operation_code;

    switch (op) {
        case OP_ADD_CONSTANT:
            wasm_addConstant(arr_ptr, length, parameter);
            return 1.0; 
            
        case OP_MULTIPLY_CONSTANT:
            wasm_addConstant(arr_ptr, length, parameter);
            return 1.0;
        default:
            return NAN; 
    }
}