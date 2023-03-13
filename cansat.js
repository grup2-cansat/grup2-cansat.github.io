import * as THREE from 'https://unpkg.com/three/build/three.module.js';

const params = {
	n_lines: 8,
	viewport: {
		fov: 70,
		factor: 1.2
	},
	colors: {
		current: {},
		dark: {
			back: new THREE.Color(0x37538b),
			lines: new THREE.Color(1, 1, 1)
		},
		light: {
			back: new THREE.Color(1, 1, 1),
			lines: new THREE.Color(0, 0, 0)
		}
	},
	materials: {
		can: new THREE.MeshStandardMaterial({ color: 0x2d4472, flatShading: true }),
		chute: new THREE.MeshStandardMaterial({ color: 0xe5ddc0, flatShading: true, side: THREE.DoubleSide })
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
const scale = 1;
renderer.setSize(scale * canvas_dimen.width, scale * canvas_dimen.height);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(params.viewport.fov, canvas_dimen.width / canvas_dimen.height, 0.1, 1000);

addEventListener('resize', () => {
	canvas_dimen = renderer.domElement.getBoundingClientRect();

	camera.aspect = canvas_dimen.width / canvas_dimen.height;
	camera.updateProjectionMatrix();
	renderer.setSize(canvas_dimen.width, canvas_dimen.height);
});

const set_colors = query => {
	const mode = query.matches ? 'dark' : 'light';

	scene.background = params.colors[mode].back;
	params.colors.current = params.colors[mode];

	for (const [material, color_key] of set_colors.materials)
		material.color = params.colors.current[color_key];
};

set_colors.materials = [];

const use_theme = material => {
	const colors = params.colors.current;
	const color_key = Object.keys(colors).find(key => colors[key].getHex() == material.color.getHex());
	set_colors.materials.push([material, color_key]);
}

const color_query = matchMedia('(prefers-color-scheme: dark)');
color_query.addEventListener('change', set_colors);
set_colors(color_query);

const line_material = new THREE.LineBasicMaterial({ linewidth: 1 * scale, color: params.colors.current.lines });
use_theme(line_material);

const make = (geometry, material) => new THREE.Mesh(geometry, material);
const zip = (a, b) => a.map((v, i) => [v, b[i]]);

const generate_points = (n, r) => {
	const points = [];

	for (let i = 0; i < n; i++) {
		const angle = 2 * Math.PI / n * i;
		const vec = new THREE.Vector3().setFromSphericalCoords(r, Math.PI / 2, angle);
		points.push(vec);
	}

	return points;
};

const can = make(
	new THREE.CylinderGeometry(params.can.radius, params.can.radius, params.can.height, 8),
	params.materials.can);
const chute = make(
	new THREE.SphereGeometry(params.chute.radius, 16, 16, 0, 2 * Math.PI, 0, params.chute.opening),
	params.materials.chute);
chute.position.y = params.chute.offset;

const lines_origin = new THREE.Vector3(0, params.can.height / 2, 0);
const lines = zip(
	generate_points(params.n_lines, params.chute.radius * Math.sin(params.chute.opening)),
	generate_points(params.n_lines, params.can.radius)
).map(([top, bot]) => {
	const ps = [bot.setY(params.can.height / 2), top.setY(params.chute.offset + params.chute.radius * Math.cos(params.chute.opening))];
	const geom = new THREE.BufferGeometry().setFromPoints(ps);
	return new THREE.Line(geom, line_material);
});

const satellite = new THREE.Group();
satellite.add(can, chute, ...lines);

const bbox = new THREE.Box3().setFromObject(satellite);
const vert_extent = Math.abs(bbox.min.y) + Math.abs(bbox.max.y);
const center = new THREE.Vector3();
bbox.getCenter(center);

const ambient = new THREE.AmbientLight(0xffffff, 0.2);
const point = new THREE.PointLight(0xeeeeff, 0.9);
point.position.set(20, 30, 10);
point.castShadows = true;

for (const object of [can, chute, ...lines]) {
	object.castShadow = true;
	object.receiveShadow = true;
}

renderer.shadowMap.enabled = true;

scene.add(satellite, ambient, point);
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