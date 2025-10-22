let costs = [1]; 
for (let cost = 1, x = 1; x<20; x++) {
    cost = cost + Math.ceil( (cost * Math.sqrt(5)) / (2 * x))
    costs.push(cost)
}
console.log(costs)
