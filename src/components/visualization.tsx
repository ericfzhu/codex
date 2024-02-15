import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Raycaster, Vector2 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VisualizationProps, DataItem } from '@/types';

function Visualization({ data }: VisualizationProps): JSX.Element {
	const mountRef = useRef<HTMLDivElement>(null);
	const raycaster = new Raycaster();
	const mouse = new Vector2();
	const scene = new THREE.Scene();
	const [selectedItem, setSelectedItem] = useState<DataItem | null>(null);
	let camera: THREE.PerspectiveCamera;
	let renderer: THREE.WebGLRenderer;
	let controls: OrbitControls;

	useEffect(() => {
		camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
		renderer = new THREE.WebGLRenderer();
		controls = new OrbitControls(camera, renderer.domElement);
		const width = mountRef.current!.clientWidth;
		const height = mountRef.current!.clientHeight;

		renderer.setSize(width, height);
		mountRef.current!.appendChild(renderer.domElement);

		const onCanvasMouseMove = (event: MouseEvent) => {
			mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
			mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
		};

		window.addEventListener('mousemove', onCanvasMouseMove);

		// Request animation frame or similar to periodically check for intersects
		const animate = () => {
			requestAnimationFrame(animate);
			checkIntersects(); // Call this function in your animation loop to check for hover
			renderer.render(scene, camera);
			controls.update();
		};
		animate();

		const resizeObserver = new ResizeObserver((entries) => {
			if (entries.length > 0) {
				const entry = entries[0];
				const { width, height } = entry.contentRect;
				renderer.setSize(width, height);
				camera.aspect = width / height;
				camera.updateProjectionMatrix();
			}
		});

		resizeObserver.observe(mountRef.current!);

		// Cleanup
		return () => {
			window.removeEventListener('mousemove', onCanvasMouseMove);
			resizeObserver.disconnect();
		};
	}, []);

	const checkIntersects = () => {
		raycaster.setFromCamera(mouse, camera);
		const intersects = raycaster.intersectObjects(scene.children);
		// console.log(camera.position, camera.lookAt(scene.position))

		if (intersects.length > 0) {
			const intersect = intersects[0];
			const point = intersect.object as THREE.Points;
			const index = intersect.index!; // Index of the vertex in the geometry

			// Assuming you have a way to map from the vertex index to your data item
			const dataItem = data[index];
			// console.log(`Clicked on: ${dataItem.Quote}, by ${dataItem.Author}, from ${dataItem['Book Title']}`);

			setSelectedItem(dataItem);
		}
	};

	useEffect(() => {
		if (!mountRef.current) return;
		camera.position.set(550, 980, -260); // Adjust camera position
		camera.lookAt(scene.position);

		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setClearColor(0x000000); // Ensure clear color contrasts with points
		mountRef.current.appendChild(renderer.domElement);

		const pointsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1, vertexColors: true });
		const positions: number[] = [];
		const colors: number[] = [];

		data.forEach((item, index) => {
			try {
				// Assuming `Embeddings_3D` is a string that looks like a JSON array.
				// Parse the string as JSON to get the actual array of numbers.
				const embeddings = JSON.parse(item.Embeddings_3D);

				if (embeddings.length === 3) {
					const [x, y, z] = embeddings;
					positions.push(x * 100, y * 100, z * 100);
					const color = new THREE.Color(Math.random() * 0xffffff);
					colors.push(color.r, color.g, color.b);
				} else {
					console.error(`Invalid embeddings length at index ${index}: `, embeddings);
				}
			} catch (error) {
				console.error(`Error parsing embeddings at index ${index}: `, item.Embeddings_3D, error);
			}
		});

		if (positions.length === 0) {
			console.error('No valid positions found. Check data parsing.');
			return;
		}

		const pointsGeometry = new THREE.BufferGeometry();
		pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		pointsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

		const points = new THREE.Points(pointsGeometry, pointsMaterial);
		scene.add(points);

		const animate = () => {
			requestAnimationFrame(animate);
			controls.update();
			renderer.render(scene, camera);
		};

		animate();

		return () => {
			if (mountRef.current) {
				mountRef.current.removeChild(renderer.domElement);
			}
		};
	}, [data]);

	return (
		<div className="w-full h-screen relative">
			<div ref={mountRef} className="w-full h-full" />
			{selectedItem && (
				<div className="absolute top-2 left-2 text-white max-w-3xl w-full duration-300">
					<p className="mb-10 whitespace-pre-wrap">{selectedItem.Quote}</p>
					<div className="flex justify-end">
						<p className="mr-2">
							{selectedItem.Author}
							{selectedItem['Book Title'] && ','}
						</p>
						{selectedItem['Book Title'] && <p className="italic">{selectedItem['Book Title']}</p>}
					</div>
				</div>
			)}
		</div>
	);
}

export default Visualization;
