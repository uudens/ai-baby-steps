const CAR_SIZE = 10
const START_X = 250
const START_Y = 250
const TICK_LENGTH = 1
const MAX_AGE = 100000 / TICK_LENGTH // ticks
const MUTABILITy = 0.01

const genEl = document.querySelector('.gen')
const bestEl = document.querySelector('.best')
const seedEl = document.querySelector('.seed')
const inputsEl = document.querySelector('.inputs')
const weightsEl = document.querySelector('.weights')
const hiddenEl = document.querySelector('.hidden')
const outputsEl = document.querySelector('.outputs')

MersenneTwister = window.MersenneTwister || function() {
  this.seed = () => null
  this.random = () => Math.random()
}

const mt = new MersenneTwister()
const seed = Math.round(Math.random() * 100000)
seedEl.innerText = seed
mt.seed(seed)
function random() {
  return mt.random()
}

function createCanvasAndGetContext() {
  const canvas = document.createElement('canvas')
  canvas.width = 500
  canvas.height = 500
  canvas.style.border = '1px solid #ccc'
  document.getElementById('root').appendChild(canvas)
  return canvas.getContext('2d')
}

function sig(x) {
  return 1 / (1 + Math.exp(-x))
}

function calcDistance(a, b) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2))
}

class Car {
  constructor({ x = START_X, y = START_Y, weights }) {
    this.v = 3
    this.x = Math.floor(random() * 500)
    this.y = Math.floor(random() * 500)
    this.theta = random() * 2 * Math.PI
    this.weights = weights
    this.foodEaten = 0
  }

  eat () {
    this.foodEaten += 1
  }

  acceerate() {
    this.v += 1
  }

  brake() {
    this.v -= 1
  }

  steer(isRight) {
    this.theta += (isRight ? 1 : -1) * (Math.PI / 36)
  }

  steerRight() {
    this.steer(true)
  }

  steerLeft() {
    this.steer(false)
  }

  updateParameters({ distanceToFood }) {
    const inputs = [distanceToFood, this.theta / (2 * Math.PI), this.v]
    const weights = this.weights
    const z0 = sig(inputs.reduce((sum, value, i) => sum + value * weights.slice(0, 3)[i], 0))
    const z1 = sig(inputs.reduce((sum, value, i) => sum + value * weights.slice(3, 6)[i], 0))
    const out0 = sig([z0, z1].reduce((sum, value, i) => sum + value * weights.slice(6, 8)[i], 0))
    const out1 = sig([z0, z1].reduce((sum, value, i) => sum + value * weights.slice(8, 10)[i], 0))

    // inputsEl.innerText = inputs.join()
    // weightsEl.innerText = weights.join()
    // hiddenEl.innerText = [z0, z1].join()
    // outputsEl.innerText = [out0, out1].join()

    if (random() < out0) {
      this.steerRight()
    }
    if (random() < out1) {
      this.steerLeft()
    }
  }

  tick() {
    this.x = this.x + this.v * Math.cos(this.theta)
    this.y = this.y + this.v * Math.sin(this.theta)
  }

  draw(ctx) {
    ctx.arc(this.x, this.y, CAR_SIZE / 2, 0, 2 * Math.PI)
    ctx.moveTo(this.x, this.y)
    ctx.lineTo(this.x + CAR_SIZE * Math.cos(this.theta), this.y + CAR_SIZE * Math.sin(this.theta))
  }
}

function tick({ ctx, cars, food, generateNewFood, resolve }) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  food.forEach(foodPiece => {
    ctx.beginPath()
    ctx.arc(foodPiece.x, foodPiece.y, 5, 0, 2 * Math.PI)
    ctx.closePath()
    ctx.fillStyle = 'red'
    ctx.fill()
  })
  cars.forEach(car => {
    const closestFoodDistance = food.reduce((closest, current) => calcDistance(current, car) < closest ? calcDistance(current, car) : closest, Infinity)
    if (closestFoodDistance <= 10) {
      car.eat()
      food.splice(food.findIndex(f => calcDistance(f, car) === closestFoodDistance), 1)
      generateNewFood()
      if (car.foodEaten >= 5) {
        resolve(cars)
      }
    }
    const isBest = sort(cars)[0] === car
    car.updateParameters({
      distanceToFood: closestFoodDistance / ctx.canvas.width
    })
    car.tick()
    ctx.beginPath()
    car.draw(ctx)
    ctx.closePath()
    ctx.stroke()
    if (isBest) {
      ctx.fillStyle = 'black'
      ctx.fill()
    }
  })
  bestEl.innerHTML = sort(cars)[0].foodEaten
}

function generateFood(ctx) {
  return {
    x: random() * ctx.canvas.width,
    y: random() * ctx.canvas.height,
  }
}

function live(cars, ctx) {
  let tickerId
  let food = [...Array(5)].map(() => generateFood(ctx))
  const generateNewFood = () => food.push(generateFood(ctx))
  return new Promise((resolve) => {
    tick({ ctx, cars, food, generateNewFood, resolve })
    let ticks = 1
    tickerId = setInterval(() => {
      tick({ ctx, cars, food, generateNewFood, resolve })
      ticks += 1
      if (ticks > MAX_AGE) {
        resolve()
      }
    }, TICK_LENGTH)
  }).then(cars => {
    clearInterval(tickerId)
    return cars
  })
}

function sort(cars) {
  return cars.slice().sort((a, b) => b.foodEaten - a.foodEaten)
}

function killHalf(cars) {
  let deathCount = 0
  return cars.filter((car, i) => {
    const probabilityOfDeath = (i + 1) / cars.length
    if (random() < probabilityOfDeath) {
      deathCount += 1
      if (deathCount < cars.length / 2) {
        return false
      }
    }
    return true
  }).slice(0, cars.length / 2)
}

function mutate(cars) {
  return cars.map(car => new Car({
    weights: car.weights.map(w => w + MUTABILITy * random() - MUTABILITy / 2)
  }))
}

let genCount = 0
function runGeneration(cars, ctx) {
  console.log('New gen!')
  genCount += 1
  genEl.innerText = genCount
  live(cars, ctx)
    .then(cars => {
      const sortedCars = sort(cars)
      const best = killHalf(sortedCars)
      const newCars = mutate(best).concat(mutate(best))
      runGeneration(newCars, ctx)
    })
    .catch((err) => {
      console.log('Gen failed', err);
      // runGeneration(cars, ctx)
    })
}

const context = createCanvasAndGetContext()
const cars = [...Array(100)].map(() => new Car({
  weights: [...Array(10)].map(random),
}))
runGeneration(cars, context)

// window.addEventListener('keydown', ({ keyCode }) => {
//   switch (keyCode) {
//     case 39:
//       car.steerRight()
//       break
//     case 37:
//       car.steerLeft()
//       break
//     case 38:
//       car.acceerate()
//       break
//     case 40:
//       car.brake()
//       break
//   }
// })
