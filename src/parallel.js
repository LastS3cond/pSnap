
self.onmessage = (msg) => {
    console.log('[Worker] Received data:', msg.data);
    const { type, data, mapperCode, reducerCode } = msg.data;

    if (type === 'map') {
        const mapper = new Function('item', mapperCode);
        const result = data.map(item => mapper(item));
        self.postMessage({ type: 'mapResult', result });
    }

    if (type === 'reduce') {
        const reducer = new Function('a', 'b', reducerCode);
        let acc = data[0];
        for (let i = 1; i < data.length; i++) {
            acc = reducer(acc, data[i]);
        }
        self.postMessage({ type: 'reduceResult', result: acc });
    }
};


// self.onmessage = (msg) => {
//     type = msg.data['type']
//     data = msg.data['data']
//     if(type == 'sum_list')
//     {
//         self.postMessage(sum_list(data))
//     }
// }
  

// function sum_list(l) {
//     let i, sum = 0;
//     if (l instanceof Array) {
//         for (i=0 ; i<l.length; i++) {
//             sum = sum + Number(l[i]);
//         }
//         return sum;
//     } else {
//         return l;
//     }
// }