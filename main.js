/* global THREE */

function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return new THREE.Color(r + m, g + m, b + m);
}

function createTextSprite(text, color) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fontSize = 64;
    ctx.font = `${fontSize}px Arial`;
    const padding = 20;
    const metrics = ctx.measureText(text);
    const w = Math.ceil(metrics.width) + padding * 2;
    const h = fontSize + padding * 2;
    canvas.width = w;
    canvas.height = h;
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';
    // ctx.globalAlpha = 0.35;
    // ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = `#${new THREE.Color(color).getHexString()}`;
    ctx.fillText(text, w / 2, h / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    // scale down to scene units
    const scale = 8;
    const aspect = w / h;
    sprite.scale.set(scale * aspect, scale, 1);
    return sprite;
}

function createAxis(length, color, labelText, arrowOffset = 0) {
    const material = new THREE.LineBasicMaterial({ color });
    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(length, 0, 0)
    ]);
    const line = new THREE.Line(geometry, material);

    // Cone arrow pointing along +X in local space (Cone by default points +Y)
    const cone = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 6, 16),
        new THREE.MeshPhongMaterial({ color })
    );
    cone.rotation.z = -Math.PI / 2; // align +Y -> +X
    cone.position.set(length + arrowOffset, 0, 0);
    line.add(cone);

    // Label sprite slightly beyond the tip
    const label = createTextSprite(labelText, color);
    label.position.set(length + arrowOffset + 6, 0, 0);
    line.add(label);

    return line;
}

function createHSGradientTexture(size = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2;
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = (x - cx) / radius;
            const dy = (y - cy) / radius;
            const r = Math.sqrt(dx * dx + dy * dy);
            const idx = (y * size + x) * 4;
            if (r <= 1) {
                let theta = Math.atan2(dy, dx); // -PI..PI
                if (theta < 0) theta += Math.PI * 2; // 0..2PI
                const h = THREE.MathUtils.radToDeg(theta);
                const s = r;
                const color = hsvToRgb(h, s, 1);
                data[idx] = Math.round(color.r * 255);
                data[idx + 1] = Math.round(color.g * 255);
                data[idx + 2] = Math.round(color.b * 255);
                data[idx + 3] = 255;
            } else {
                data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
            }
        }
    }
    ctx.putImageData(imageData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

function createHSBaseDisk(radius, yMid) {
    const diskGeom = new THREE.CircleGeometry(radius, 256);
    const texture = createHSGradientTexture(1024);
    const diskMat = new THREE.MeshPhysicalMaterial({
        map: texture,
        metalness: 0.2,
        roughness: 0.25,
        clearcoat: 0.3,
        clearcoatRoughness: 0.4,
        side: THREE.DoubleSide
    });
    const disk = new THREE.Mesh(diskGeom, diskMat);
    disk.rotation.x = -Math.PI / 2; // XZ plane
    disk.position.y = yMid;
    return disk;
}

function createPolarGridHSPlane(radius, ringCount, spokeCount, yMid = 0) {
    const group = new THREE.Group();
    const ringMaterial = new THREE.LineBasicMaterial({ color: 0x333333 });
    const spokeMaterial = new THREE.LineBasicMaterial({ color: 0x222222 });

    // Concentric rings (Saturation 0..1)
    for (let i = 1; i <= ringCount; i++) {
        const r = (i / ringCount) * radius;
        const circleGeom = new THREE.CircleGeometry(r, 64);
        circleGeom.vertices?.shift(); // safety for old three versions
        const edges = new THREE.EdgesGeometry(circleGeom);
        const circle = new THREE.LineSegments(edges, ringMaterial);
        circle.rotation.x = -Math.PI / 2; // move from XY plane into XZ plane
        circle.position.y = yMid + 0.01; // avoid z-fighting with disk
        group.add(circle);
    }

    // Spokes (Hue angles)
    for (let i = 0; i < spokeCount; i++) {
        const theta = (i / spokeCount) * Math.PI * 2;
        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;
        const geom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0), new THREE.Vector3(x, 0, z)
        ]);
        const spoke = new THREE.Line(geom, spokeMaterial);
        spoke.position.y = yMid + 0.01; // avoid z-fighting with disk
        group.add(spoke);
    }

    return group;
}

function createAxesHSBPolar(radius, height) {
    const group = new THREE.Group();
    const yMid = height * 0.5; // 50% brightness plane
    // Base disk (for visuals/reflections)
    const disk = createHSBaseDisk(radius, yMid);
    group.add(disk);

    // Polar grid for H (angle) and S (radius) on XZ plane (slightly above disk)
    group.add(createPolarGridHSPlane(radius, 6, 12, yMid));

    // Vertical Brightness axis (Z)
    const bAxis = createAxis(height, 0xffffff, 'Brighness', 10);
    bAxis.rotation.z = Math.PI / 2; // align +X to +Y
    group.add(bAxis);

    // Center marker
    const origin = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    group.add(origin);

    // Saturation guide (radial arrow from origin)
    const satGuide = createAxis(radius, 0x222222, 'Saturation', 15);
    satGuide.position.y = yMid + 0.02;
    group.add(satGuide);

    // Hue guide (curved around rim with tangent arrow)
    const hueColor = 0x555555;
    const arcGeom = new THREE.TorusGeometry(radius, 0.3, 8, 128);
    const arcMat = new THREE.MeshPhongMaterial({ color: hueColor });
    const hueRing = new THREE.Mesh(arcGeom, arcMat);
    hueRing.rotation.x = -Math.PI / 2;
    hueRing.position.y = yMid + 0.02;
    group.add(hueRing);

    // Tangent arrow at angle 0 (pointing along +Z around the ring)
    const hueArrow = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 6, 16),
        new THREE.MeshPhongMaterial({ color: hueColor })
    );
    const thetaArrow = 0.1; // radians, position on rim
    const tangent = new THREE.Vector3(-Math.sin(thetaArrow), 0, Math.cos(thetaArrow)).normalize();
    hueArrow.position.set(Math.cos(thetaArrow) * (radius + 0.5), yMid + 0.02, Math.sin(thetaArrow) * (radius + 0.5));
    // orient cone (default +Y) to tangent direction
    const from = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(from, tangent);
    hueArrow.quaternion.copy(q);
    group.add(hueArrow);

    const hueLabel = createTextSprite('Hue', hueColor);
    hueLabel.position.set(radius + 6, yMid + 1, 5);
    group.add(hueLabel);

    return group;
}

function createSamplePoint(h, s, v, scale) {
    const color = hsvToRgb(h, s, v);
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 16, 16),
        new THREE.MeshPhongMaterial({ color })
    );
    mesh.position.set(h / 360 * scale, s * scale, v * scale);
    return mesh;
}

function main() {
    const canvas = document.getElementById('visualization-canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x999999);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(200, 140, 180);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 50, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(200, 200, 200);
    scene.add(dir);

    const radius = 80;    // S maps 0..1 -> 0..radius (on XZ plane)
    const height = 100;   // B maps 0..1 -> 0..100 (Y up)
    const axes = createAxesHSBPolar(radius, height);
    scene.add(axes);

    // sample points
    const samples = [
        { h: 0, s: 1, v: 1 },       // red
        { h: 120, s: 1, v: 1 },     // green
        { h: 240, s: 1, v: 1 },     // blue
        { h: 60, s: 1, v: 1 },      // yellow
        { h: 300, s: 1, v: 1 },     // magenta
        { h: 180, s: 1, v: 1 },     // cyan
        { h: 0, s: 0, v: 0.2 },     // dark gray
        { h: 0, s: 0.5, v: 1 },     // pinkish
        { h: 30, s: 0.8, v: 0.8 },  // orange
        { h: 200, s: 0.5, v: 0.7 }, // teal-ish
    ];
    function addSamplePolar(h, s, v) {
        const color = hsvToRgb(h, s, v);
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(1.8, 16, 16),
            new THREE.MeshPhongMaterial({ color })
        );
        const theta = THREE.MathUtils.degToRad(h);
        const r = s * radius;
        mesh.position.set(Math.cos(theta) * r, v * height, Math.sin(theta) * r);
        scene.add(mesh);
    }
    samples.forEach(p => addSamplePolar(p.h, p.s, p.v));


    function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    // simple about dialog wiring
    const aboutDialog = document.getElementById('aboutDialog');
    const aboutButton = document.getElementById('aboutButton');
    const closeButton = aboutDialog ? aboutDialog.querySelector('.close-button') : null;
    if (aboutButton && aboutDialog && closeButton) {
        aboutButton.addEventListener('click', () => aboutDialog.style.display = 'block');
        closeButton.addEventListener('click', () => aboutDialog.style.display = 'none');
        window.addEventListener('click', (e) => { if (e.target === aboutDialog) aboutDialog.style.display = 'none'; });
    }

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}

document.addEventListener('DOMContentLoaded', main);





