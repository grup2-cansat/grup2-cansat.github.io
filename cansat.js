import * as THREE from 'https://unpkg.com/three/build/three.module.js';

const params = {
	n_lines: 8,
	viewport: {
		fov: 70,
		factor: 1.2
	},
	colors: {
		dark: {
			back: new THREE.Color(0x37538b),
			lines: new THREE.Color(1, 1, 1)
		},
		light: {
			back: new THREE.Color(1, 1, 1),
			lines: new THREE.Color(0x2d4472)
		}
	},
	can: {
		radius: 1,
		height: 4
	},
	chute: {
		radius: 10,
		opening: THREE.MathUtils.degToRad(70),
		offset: 15
	}
};

const axis = {
	x: new THREE.Vector3(1, 0, 0),
	y: new THREE.Vector3(0, 1, 0),
	z: new THREE.Vector3(0, 0, 1)
};

const renderer = new THREE.WebGLRenderer({ antialias: false });
document.querySelector('header').append(renderer.domElement);
renderer.domElement.id = 'renderer-canvas';

let canvas_dimen = renderer.domElement.getBoundingClientRect();
const scale = window.devicePixelRatio || 1;
renderer.setSize(scale * canvas_dimen.width, scale * canvas_dimen.height);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(params.viewport.fov, canvas_dimen.width / canvas_dimen.height, 0.1, 1000);

addEventListener('resize', () => {
	canvas_dimen = renderer.domElement.getBoundingClientRect();

	camera.aspect = canvas_dimen.width / canvas_dimen.height;
	camera.updateProjectionMatrix();
	renderer.setSize(scale * canvas_dimen.width, scale * canvas_dimen.height);
});

const line_material = new THREE.LineBasicMaterial({ linewidth: 1 * scale });
const make = geometry => new THREE.LineSegments(new THREE.WireframeGeometry(geometry), line_material);
const zip = (a, b) => a.map((v, i) => [v, b[i]]);

const set_colors = query => {
	const mode = query.matches ? 'dark' : 'light';

	scene.background = params.colors[mode].back;
	line_material.color = params.colors[mode].lines;
};

const color_query = matchMedia('(prefers-color-scheme: dark)');
color_query.addEventListener('change', set_colors);
set_colors(color_query);

const generate_points = (n, r) => {
	const points = [];

	for (let i = 0; i < n; i++) {
		const angle = 2 * Math.PI / n * i;
		const vec = new THREE.Vector3().setFromSphericalCoords(r, Math.PI / 2, angle);
		points.push(vec);
	}

	return points;
};

const can = make(new THREE.CylinderGeometry(params.can.radius, params.can.radius, params.can.height));
const chute = make(new THREE.SphereGeometry(params.chute.radius, 32, 16, 0, 2 * Math.PI, 0, params.chute.opening));
chute.position.y = params.chute.offset;

const lines_origin = new THREE.Vector3(0, params.can.height / 2, 0);
const lines = zip(
	generate_points(params.n_lines, params.chute.radius * Math.sin(params.chute.opening)),
	generate_points(params.n_lines, params.can.radius)
).map(([top, bot]) => {
	const ps = [bot.setY(params.can.height / 2), top.setY(params.chute.offset + params.chute.radius * Math.cos(params.chute.opening))];
	const geom = new THREE.BufferGeometry().setFromPoints(ps);
	return make(geom);
});

const satellite = new THREE.Group();
satellite.add(can, chute, ...lines);

const bbox = new THREE.Box3().setFromObject(satellite);
const vert_extent = Math.abs(bbox.min.y) + Math.abs(bbox.max.y);
const center = new THREE.Vector3();
bbox.getCenter(center);

scene.add(satellite);
camera.position.set(0, center.y, vert_extent * params.viewport.factor / Math.tan(params.viewport.fov));

let t0 = null;
const loop = t_now => {
	if (t0 === null)
		t0 = t_now;

	const t = t_now - t0;

	satellite.position.x = 3 * Math.sin(t / 1e3);
	satellite.position.y = 0.5 * Math.cos(t / 1e3) + Math.max(0, 6e3 - t / 1e0) ** 2 / 1e6;

	const k = t => Math.min(1, 1 - (1 - t / 2e4) ** 3);
	const euler = new THREE.Euler(
		0.2 * k(t) * Math.sin(t / 8e4),
		k(t + 5e3) * t * 8e-4,
		0.2 * k(t) * Math.sin(t / 1e3),
		'ZXY');
	satellite.setRotationFromEuler(euler);

	renderer.render(scene, camera);
	requestAnimationFrame(loop);
};

addEventListener('load', () => requestAnimationFrame(loop));