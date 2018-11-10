var mic = new p5.AudioIn();
var WIDTH = window.innerWidth;
var HEIGHT = window.innerHeight;

class Shusher {
	
	constructor(shushes, tolerance = 0.1, exponent = 5) {
		this.shushes = shushes;
		this.shushing = false;
		// Tolerance is a positive number that scales the chance to shush.
		this.tolerance = tolerance;
		// Exponent is a positive number describing how the meter affects the chance to shush.
		this.exponent = exponent;
	}
	
	shush() {
		var audio = this.shushes[ Math.floor(Math.random() * this.shushes.length) ];
		// .play parameters, all optional: [startTime], [rate], [amp], [cueStart], [duration].
		audio.play(0, 1, 1);
		this.shushing = true;
		window.setTimeout((() => this.shushing = false).bind(this), audio.duration() * 1000);
	}
	
	update(meter) {
		if (Math.random() < this.tolerance * Math.pow(meter, this.exponent)) {
			this.shush();
		}
	}
}

class SoundMeter {
	
	constructor(shusher, sensitivity = 0.2, friction = 0.9, ambience = 0.02, shift = 0.5, bars = 3) {
		this.shusher = shusher;
		// The final measure of loudness, not the frame-by-frame mic input.
		this.meter = 0;
		this.velocity = 0;
		// Number between zero, unresponsive, and one, infinitely responsive.
		this.sensitivity = Math.tan(sensitivity / (Math.PI/2) );
		// Friction is like the inertia of the volume meter:
		// how much and how quickly changes in volume affect it.
		this.friction = friction;
		// Ambience is the normal, expected volume level. Environments louder
		// than it increase the meter and environments softer than it decrease the meter.
		this.ambience = ambience;
		// Shift is the amount higher ambience needs to be for the bars to increase
		// based on the current volume. Loud environments should need louder noises to
		// sustain them than quieter environments.
		this.shift = shift;
		
		this.bars = bars;
		this.barsYFraction = 0.8; // Percentage of the screen displaying the bars.
		this.graphYFraction = 0.2; // Percentage of the screen displaying the graph.
		// The list of colors between which bars will interpolate.
		this.colorPoints = [
			{"r": 0, "g": 255, "b": 0},
			{"r": 255, "g": 255, "b": 0},		
			{"r": 255, "g": 0, "b": 0}
		];
		// Bezier interpolation will transition smoothly between colors.
		this.barColors = [];
		
		this.graphInitialized = false;
		this.recordInterval = 60 * 1000; // milliseconds between plotting on the graph
		this.records = 0;
		this.graphY = 0;
		// When a new datum is recorded on the graph, it is placed at the position
		// defined by oldPos*smoothFactor + newPos*(1 - smoothFactor).
		this.smoothness = 0.8;
	}
	
	initBarColors() {
		this.barColors = [];
		for (var i = 0, n = this.colorPoints.length, j, interpolation, color; i < this.bars; i++) {
			interpolation = i / (this.bars - 1);
			color = {"r": 0, "g": 0, "b": 0};
			// Perform bezier interpolation between color markers.
			for (j = 0; j < n; j++) {
				color = {
					"r": color.r + this.colorPoints[j].r * binomial(n-1, j) * Math.pow(1 - interpolation, n-1 - j) * Math.pow(interpolation, j),
					"g": color.g + this.colorPoints[j].g * binomial(n-1, j) * Math.pow(1 - interpolation, n-1 - j) * Math.pow(interpolation, j),
					"b": color.b + this.colorPoints[j].b * binomial(n-1, j) * Math.pow(1 - interpolation, n-1 - j) * Math.pow(interpolation, j)
				};
			}
			// Push the color but twice as bright.
			this.barColors.push({"r": 2*color.r, "g": 2*color.g, "b": 2*color.b});
		}
	}
	
	init() {
		this.initBarColors();
	}
	
	listen() {
		if (!this.shusher.shushing)
			this.velocity += (mic.getLevel() - this.ambience*(1 - this.shift + this.shift*this.meter)) * this.sensitivity;
		this.velocity *= this.friction;
		this.meter += this.velocity;
		
		if (this.meter < 0) {
			this.meter = 0;
			this.velocity *= -1; // Add in a little bounce for fun.
		}
		if (this.meter > 1) {
			this.meter = 1;
			this.velocity *= -0.2; // Add in a little bounce for fun.
		}
		
		if (!this.shusher.shushing)
			this.shusher.update(this.meter);
	}
	
	displayBars() {
		noStroke();
		fill(0, 0, 0);
		rect(-WIDTH/2, -HEIGHT/2, WIDTH, HEIGHT * this.barsYFraction);
		
		var interpolation, color, height, i;
		for (i = 0; i < this.bars; i++) {
			interpolation = i / this.bars;
			color = this.barColors[i];
			if (interpolation >= this.meter) // If meter hasn't even reached the bar, set its height to 0.
				height = 0;
			else if (interpolation + 1 / this.bars <= this.meter) // If meter has passed the bar, set its height to 1.
				height = 1;
			else // If meter is upon the bar, set its height accordingly.
				height = this.meter % (1 / this.bars) * this.bars;
			noStroke();
			fill(color.r, color.g, color.b);
			rect(-WIDTH/2 + WIDTH * interpolation, -HEIGHT/2 + HEIGHT * this.barsYFraction, WIDTH / this.bars, -HEIGHT * this.barsYFraction * height);
		}
	}
	
	initGraph() {
		noStroke();
		fill(0, 0, 0);
		rect(-WIDTH/2, HEIGHT/2, WIDTH, -HEIGHT * (1 - this.barsYFraction));
	}
	
	displayGraph() {
		if (!this.graphInitialized) {
			this.graphInitialized = true;
			this.initGraph();
		}
		
		if (window.performance.now() > this.records*this.recordInterval) {
			this.records++;
			var date = new Date(), hour = date.getHours(), minute = date.getMinutes(), second = date.getSeconds();
			var percentage = (hour*3600 + minute*60 + second) / 86400;
			this.graphY = this.graphY * this.smoothness + this.meter * (1 - this.smoothness);
			noStroke();
			fill(0, 255, 0);
			rect(-WIDTH/2 + WIDTH*percentage, HEIGHT/2, this.recordInterval/86400, -HEIGHT*this.graphYFraction*this.graphY);
		}
	}
	
	display() {
		this.displayBars();
		this.displayGraph();
	}
	
}

function factorial(n) {
	var product = 1, i;
	for (i = 2; i <= n; i++) {
		product *= i;
	}
	return product;
}
function binomial(n, k) {
	return factorial(n) / (factorial(k) * factorial(n - k));
}

var p5 = new p5();
var shushes = [
	p5.loadSound("shush1.mp3"),
	p5.loadSound("shush2.mp3"),
	p5.loadSound("shush3.mp3"),
	p5.loadSound("shush4.mp3")
];

function setup() {
	createCanvas(WIDTH, HEIGHT);
	mic.start();
}

var shusher = new Shusher(shushes, 0.01, 6);
// var meter = new SoundMeter(shusher, 0.02, 0.9, 0.02, 0.5, 3); // Khan Academy
// var meter = new SoundMeter(shusher, 0.02, 0.9, 0.03, 0.8, 3); // Goal Time
var meter = new SoundMeter(shusher, 0.02, 0.9, 0.04, 0.8, 3); // Break
// var meter = new SoundMeter(shusher, 0.02, 0.9, 0.05, 0.8, 3); // Lunch
meter.init();

function draw() {
	translate(WIDTH/2, HEIGHT/2);
	
	meter.listen();
	meter.display();
}