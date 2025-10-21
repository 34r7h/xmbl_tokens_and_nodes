var increment = function (start, length, coinSupply) {
    const config = {
      coins: {
        released: 0,
        remaining: coinSupply,
        targetRelease: start * 2,
        incrementBy: coinSupply / 9
      },
      tokens: {
        cost: start
      },
      growth: (1 + Math.sqrt(5)) / 2,
      growthPow: ((1 + Math.sqrt(5)) / 2) ** ((1 + Math.sqrt(5)) / 2)
    }
  
    var totalCost = 0
  
    for (var difference = 0, x = 1; x <= length; x++) {
      var oldDiff = difference
      var oldCost = config.tokens.cost
      difference = config.tokens.cost / (config.tokens.cost + (config.tokens.cost / config.growth * x))
      config.tokens.cost = config.tokens.cost + (config.tokens.cost / (config.growth * x))
      totalCost += config.tokens.cost
      if (config.coins.remaining > 0 && config.tokens.cost > config.coins.targetRelease) {
        config.coins.released += Math.floor(config.coins.remaining / config.coins.incrementBy)
        config.coins.incrementBy = config.coins.incrementBy / 2
        config.coins.remaining = coinSupply - config.coins.released
        config.coins.targetRelease *= config.growth 
        // console.log(totalCost)
        // console.log('\n\nCoin distribution event\n\n', config.coins, `\nat token ${x} price of ${config.tokens.cost}. Total spent on tokens: ${totalCost} \n\n`)
        // console.log(`token ${x} costs: [ ${config.tokens.cost} ]`, `\n\n - - Actual difference: [ ${Math.abs(oldCost - config.tokens.cost)} ]`, `\n - - Rate differential: [ ${Math.abs(difference - oldDiff)} ]\n\nTotal to buy: ${totalCost}\n\n`) 
        if (Math.floor(config.coins.remaining) < 2) {
          config.coins.released += config.coins.remaining
          config.coins.remaining = 0
          // console.log(`All coins distributed`, config.coins, `at token ${x}\n\n`)
      // console.log(`token ${x} costs: [ ${config.tokens.cost} ]`, `\n\n - - Actual difference: [ ${Math.abs(oldCost - config.tokens.cost)} ]`, `\n - - Rate differential: [ ${Math.abs(difference - oldDiff)} ]\n\nTotal to buy: ${totalCost}\n\n`)	
        }
      }
     if (x % 100000000 == 0 || x == length || x == 1) {
      console.log(config.coins.released)
           // console.log(config.coins.released)
      // console.log(`token ${x} costs: [ ${config.tokens.cost} ]`, `\n\n - - Actual difference: [ ${Math.abs(oldCost - config.tokens.cost)} ]`, `\n - - Rate differential: [ ${Math.abs(difference - oldDiff)} ]\n\nTotal to buy: ${totalCost}\n\n`)
      }
    }
    console.log(`First ${length} cost ${totalCost}`)
  }
  increment(.001, 1000000000, 999999999)