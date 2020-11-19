export default function define(runtime, observer) {
	const main = runtime.module();
	const fileAttachments = new Map([["data_1.5.csv",new URL("./files/satelliteDataset",import.meta.url)]]);
	main.builtin("FileAttachment", runtime.fileAttachments(name => fileAttachments.get(name)));

	  main.variable(observer("globe")).define("globe", ["renderer","scene","camera"], function*(renderer,scene,camera)
	{  
	  while (true) {
		renderer.render(scene, camera);
		yield renderer.domElement;
	  }
	}
	);
	  main.variable(observer("simulate")).define("simulate", ["Promises","earth","earthAngularVelocity","orbit"], async function*(Promises,earth,earthAngularVelocity,orbit)
	{
	  let lastUpdated = performance.now();
	  let timeScale = 1000;
	  
	  while (true) {
		await Promises.tick(1000 / 60);
		const currentTime = performance.now();
		
		const simulatedTimeDelta = (currentTime - lastUpdated) * timeScale / 1000;

		// simulate rotation of the Earth
		earth.rotation.y += earthAngularVelocity * simulatedTimeDelta;
		
		// rotate satellite  
		for (let obt of orbit) {
		  obt.rotation.y += obt.satelliteAngularVelocity * simulatedTimeDelta;
		}

		lastUpdated = currentTime;
		yield;
	  }
	}
	);
	  main.variable(observer("scene")).define("scene", ["THREE","earth","light","orbit"], function(THREE,earth,light,orbit)
	{
	  let scene = this;
	  
	  if (!scene) {
		scene = new THREE.Scene();
		scene.background = new THREE.Color('#000000');
		scene.add(earth, light);
	//    scene.add(orbit);
		
		for (let obt of orbit) {
		  scene.add(obt);          
		}
		
	  }

	  return scene;
	}
	);
	  main.variable(observer("orbit")).define("orbit", ["dataset","THREE","G","earthMass","earthRadius"], function(dataset,THREE,G,earthMass,earthRadius)
	{
	  
	  let orbit_array = [];
	  
	  for (let row of dataset) {

		let orbit = this;
		orbit = new THREE.Group();
		
		// ----- Set variables ---------------------

		let satelliteInclination = +row["Inclination (degrees)"];
		orbit.satelliteInclination = satelliteInclination;
		
		let satelliteAltitude = +row["Apogee (km)"] * 1000;
		orbit.satelliteAltitude = satelliteAltitude;
		
		let satelliteVelocity = Math.sqrt(G * earthMass / (earthRadius + satelliteAltitude)); // meters per second
		let satelliteAngularVelocity = satelliteVelocity / (earthRadius + satelliteAltitude);  // radians per second
		orbit.satelliteAngularVelocity = satelliteAngularVelocity;
		
		let orbitRadiusInEarthRadii = (earthRadius + satelliteAltitude) / earthRadius;
		orbit.orbitRadiusInEarthRadii = orbitRadiusInEarthRadii;
		
		let orbit_type = row["Class of Orbit"];

		// ----- Track -------------------------------------

		let track = this;
		track = new THREE.Line();

		track.geometry = new THREE.CircleGeometry(1, 80);
		track.geometry.vertices.shift();
		track.geometry.vertices.push(track.geometry.vertices[0]);
		track.geometry.rotateX(Math.PI / 2); // rotate geometry so default is equatorial orbit
		
		if (orbit_type == "GEO") {
		  track.material = new THREE.LineBasicMaterial({ color: 0xf2d96b }); // yellow ffd000
		}
		else if (orbit_type == "LEO") {
		  track.material = new THREE.LineBasicMaterial({ color: 0x7ee695 }); // green 05612a
		}
		else if (orbit_type == "MEO") {
		  track.material = new THREE.LineBasicMaterial({ color: 0xf1f8ff }); // blue 72afed
		  //track.material = new THREE.LineBasicMaterial({ color: 0xf2d96b }); // yellow ffd000
		  //track.material = new THREE.LineBasicMaterial({ color: 0xe86868 }); // red  ff0000
		}
		else {
		  track.material = new THREE.LineBasicMaterial({ color: 0xed7be0 }); // pink ff00e1
		}
		
		// Geo - Red
		// Leo - Green
		// Meo - Blue
		// Elliptical - Pink

		track.scale.setScalar(orbitRadiusInEarthRadii);

		// ------ Satellite ---------------------------------------

		var dotGeometry = new THREE.Geometry();
		dotGeometry.vertices.push(new THREE.Vector3( 0, 0, 0));
		
		if (orbit_type == "GEO") {
		  //var dotMaterial = new THREE.PointsMaterial( { size: 4, sizeAttenuation: false, color: 0xff0000 } ); // Red
		  var dotMaterial = new THREE.PointsMaterial( { size: 4, sizeAttenuation: false, color: 0xffd000 } ); // Yellow
		}
		else if (orbit_type == "LEO") {
		  var dotMaterial = new THREE.PointsMaterial( { size: 4, sizeAttenuation: false, color: 0x05612a } ); // Green
		}
		else if (orbit_type == "MEO") {
		  var dotMaterial = new THREE.PointsMaterial( { size: 4, sizeAttenuation: false, color: 0x72afed } ); // Blue
		  //var dotMaterial = new THREE.PointsMaterial( { size: 4, sizeAttenuation: false, color: 0xffd000 } ); // Yellow
		  //var dotMaterial = new THREE.PointsMaterial( { size: 4, sizeAttenuation: false, color: 0xff0000 } ); // Red
		}
		else {
		  var dotMaterial = new THREE.PointsMaterial( { size: 4, sizeAttenuation: false, color: 0xff00e1 } ); // Pink
		}
		var satellite = new THREE.Points( dotGeometry, dotMaterial );

		//  satellite.scale.setScalar(1.20);
		satellite.position.x = orbitRadiusInEarthRadii;

		// --------Add track and satellite to orbit -------------------------------------

		orbit.add(track, satellite);
		orbit.rotation.x = satelliteInclination * Math.PI / 180;

		orbit_array.push(orbit);
	  }
	  return orbit_array;
	}
	);
	
	  main.variable(observer("renderer")).define("renderer", ["THREE","width","invalidation"], function(THREE,width,invalidation)
	{
	  const renderer = new THREE.WebGLRenderer({antialias: true})
		
	//  renderer.setSize(width, width / 2);
	  renderer.setSize(window.innerWidth * 0.9, 700);
	  renderer.setPixelRatio(devicePixelRatio);
	  
	  invalidation.then(() => renderer.dispose());
	  
	  return renderer;
	}
	);
	  main.variable(observer("controls")).define("controls", ["THREE","camera","renderer","scene","invalidation"], function(THREE,camera,renderer,scene,invalidation)
	{
	  const controls = new THREE.OrbitControls(camera, renderer.domElement);
	  controls.minDistance = 3;
	  controls.maxDistance = 40;
	  
	  const redraw = () => renderer.render(scene, camera);
	  
	  controls.addEventListener("change", redraw);
	  
	  invalidation.then(() => {
		controls.removeEventListener("change", redraw);
		controls.dispose();
	  });
	  
	  return controls;
	}
	);
	  main.variable(observer("camera")).define("camera", ["THREE"], function(THREE)
	{
	  //const camera = new THREE.PerspectiveCamera(30, 2, 0.1, 60);
	  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
	  camera.position.set(7, 3, 2);
	  return camera;
	}
	);
	  main.variable(observer("light")).define("light", ["THREE"], function(THREE)
	{
	  const light = new THREE.Group();
	  
	  const ambient = new THREE.AmbientLight("#888")
	  const directional = new THREE.DirectionalLight("#aaa")
	  directional.position.x = 10;
	  
	  light.add(ambient, directional)
	  return light;
	}
	);
	  main.variable(observer("earth")).define("earth", ["THREE"], function(THREE)
	{
	  let earth = this;
	  
	  if (!earth) {
		earth = new THREE.Mesh();
		earth.geometry = new THREE.SphereBufferGeometry(1, 40, 40);
		earth.rotation.y = Math.PI;
	  }
	  
	  return earth;
	}
	);
	  main.variable(observer("texture")).define("texture", ["THREE","map","earth"], function(THREE,map,earth)
	{
	  let texture = this;
	  
	  if (!texture) {
		texture = new THREE.CanvasTexture(map);
		earth.material = new THREE.MeshLambertMaterial({ map: texture });
	  } else {
		texture.needsUpdate = true;
	  }
	  
	  return texture;
	}
	);
	  main.variable(observer("G")).define("G", function(){return(
	6.67191e-11
	)});
	  main.variable(observer("earthMass")).define("earthMass", function(){return(
	5.9721986e24
	)});
	  main.variable(observer("earthRadius")).define("earthRadius", function(){return(
	6371 * 1000
	)});
	  main.variable(observer("earthAngularVelocity")).define("earthAngularVelocity", function(){return(
	(2 * Math.PI) / (23.934461223 * 60 * 60)
	)});
	  main.variable(observer("map")).define("map", ["DOM","width","d3","naturalEarth"], function(DOM,width,d3,naturalEarth)
	{
	  let canvas = this;

	  if (!canvas) {
		canvas = DOM.context2d(width, width/2).canvas;
	  }
	  
	  let context = canvas.getContext("2d");

	  const path = d3.geoPath()
		.context(context);
	  
	  context.drawImage(naturalEarth, 0, 0, width, width/2);
	 
	  return canvas;
	}
	);
	  main.variable(observer("naturalEarth")).define("naturalEarth", ["d3"], function(d3){return(
	d3.image(
	  "https://gist.githubusercontent.com/jake-low/d519e00853b15e9cec391c3dab58e77f/raw/6e796038e4f34524059997f8e1f1c42ea289d805/ne1-small.png",
	  {crossOrigin: "anonymous"})
	)});
	  main.variable(observer("dataset")).define("dataset", ["d3","FileAttachment"], async function(d3,FileAttachment){return(
	d3.csvParse(await FileAttachment("data_1.5.csv").text())
	)});
	  main.variable(observer("THREE")).define("THREE", ["require"], async function(require)
	{
	  const THREE = window.THREE = await require("three@0.97/build/three.min.js");
	  await require("three@0.97/examples/js/controls/OrbitControls.js").catch(() => {});
	  return THREE;
	}
	);
	  main.variable(observer("d3")).define("d3", ["require"], function(require){return(
	require("d3@5")
	)});
	  return main;
}
