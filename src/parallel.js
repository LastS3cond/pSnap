
self.onmessage = (msg) => {
    type = msg.data['type']
    data = msg.data['data']
    if(type == 'sum_list')
    {
        self.postMessage(sum_list(data))
    }
}
  

function sum_list(l) {
    let i, sum = 0;
    if (l instanceof Array) {
        for (i=0 ; i<l.length; i++) {
            sum = sum + Number(l[i]);
        }
        return sum;
    } else {
        return l;
    }
}
