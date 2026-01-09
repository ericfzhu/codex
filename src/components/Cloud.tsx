import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CloudDataItem } from '@/types';

interface Point {
	x: number;
	y: number;
	item: CloudDataItem;
}

interface Filter {
	type: 'author' | 'book' | 'religion';
	value: string;
}

interface CloudProps {
	data: CloudDataItem[];
	showFilters: boolean;
	onToggleFilters: () => void;
}

// WebGL shaders for high-performance point rendering
const vertexShaderSource = `
	attribute vec2 a_position;
	attribute vec3 a_color;
	attribute float a_size;
	attribute float a_isLocked;
	uniform vec2 u_resolution;
	uniform vec2 u_translation;
	uniform float u_scale;
	varying vec3 v_color;
	varying float v_isLocked;
	void main() {
		vec2 pos = (a_position * u_scale + u_translation) / u_resolution * 2.0;
		gl_Position = vec4(pos.x, -pos.y, 0, 1);
		gl_PointSize = a_size;
		v_color = a_color;
		v_isLocked = a_isLocked;
	}
`;

const fragmentShaderSource = `
	precision mediump float;
	varying vec3 v_color;
	varying float v_isLocked;
	void main() {
		vec2 coord = gl_PointCoord - vec2(0.5);
		float dist = length(coord);
		if (dist > 0.5) discard;
		// Draw white ring around locked items, keep original color inside
		if (v_isLocked > 0.5 && dist > 0.35) {
			gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
		} else {
			gl_FragColor = vec4(v_color, 1.0);
		}
	}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
	const shader = gl.createShader(type);
	if (!shader) return null;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error('Shader compile error:', gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}

function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
	const program = gl.createProgram();
	if (!program) return null;
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error('Program link error:', gl.getProgramInfoLog(program));
		gl.deleteProgram(program);
		return null;
	}
	return program;
}

// Convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
	s /= 100;
	l /= 100;
	const k = (n: number) => (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	return [f(0), f(8), f(4)];
}

export default function Cloud({ data, showFilters, onToggleFilters }: CloudProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const glRef = useRef<WebGLRenderingContext | null>(null);
	const programRef = useRef<WebGLProgram | null>(null);
	const buffersRef = useRef<{ position: WebGLBuffer | null; color: WebGLBuffer | null; size: WebGLBuffer | null; isLocked: WebGLBuffer | null }>({ position: null, color: null, size: null, isLocked: null });
	const [hoveredItem, setHoveredItem] = useState<CloudDataItem | null>(null);
	const [lockedItem, setLockedItem] = useState<CloudDataItem | null>(null);
	const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
	const [isDragging, setIsDragging] = useState(false);
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
	const [clickStart, setClickStart] = useState<{ x: number; y: number } | null>(null);
	const [activeFilters, setActiveFilters] = useState<Filter[]>([]);
	const [searchTerm, setSearchTerm] = useState('');
	const pointsRef = useRef<Point[]>([]);

	// Extract unique authors, books, and religions for filtering
	const authors = Array.from(new Set(data.map((d) => d.author).filter((a): a is string => typeof a === 'string' && a.length > 0))).sort();
	const books = Array.from(new Set(data.map((d) => d.book).filter((b): b is string => typeof b === 'string' && b.length > 0))).sort();
	const religions = Array.from(new Set(data.map((d) => d.religion).filter((r): r is string => typeof r === 'string' && r.length > 0))).sort();

	// Parse data into 2D points and center the cloud
	useEffect(() => {
		const points: Point[] = [];
		let minX = Infinity, maxX = -Infinity;
		let minY = Infinity, maxY = -Infinity;

		data.forEach((item) => {
			const x = item.x * 20;
			const y = item.y * 20;
			points.push({ x, y, item });
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);
		});

		if (points.length > 0) {
			const centerX = (minX + maxX) / 2;
			const centerY = (minY + maxY) / 2;
			points.forEach((p) => {
				p.x -= centerX;
				p.y -= centerY;
			});
		}

		pointsRef.current = points;
	}, [data]);

	// Check if a point matches active filters
	const matchesFilters = useCallback(
		(item: CloudDataItem) => {
			if (activeFilters.length === 0) return true;
			return activeFilters.some((filter) => {
				if (filter.type === 'author') return item.author === filter.value;
				if (filter.type === 'book') return item.book === filter.value;
				if (filter.type === 'religion') return item.religion === filter.value;
				return false;
			});
		},
		[activeFilters]
	);

	// Initialize WebGL
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const gl = canvas.getContext('webgl', { antialias: true });
		if (!gl) {
			console.error('WebGL not supported');
			return;
		}
		glRef.current = gl;

		const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
		const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
		if (!vertexShader || !fragmentShader) return;

		const program = createProgram(gl, vertexShader, fragmentShader);
		if (!program) return;
		programRef.current = program;

		buffersRef.current = {
			position: gl.createBuffer(),
			color: gl.createBuffer(),
			size: gl.createBuffer(),
			isLocked: gl.createBuffer(),
		};

		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	}, []);

	// Update buffers when filters or locked item change
	useEffect(() => {
		const gl = glRef.current;
		if (!gl || !buffersRef.current.position) return;

		const points = pointsRef.current;
		const hasFilters = activeFilters.length > 0;

		const positions = new Float32Array(points.length * 2);
		const colors = new Float32Array(points.length * 3);
		const sizes = new Float32Array(points.length);
		const isLockedArr = new Float32Array(points.length);

		points.forEach((point, i) => {
			positions[i * 2] = point.x;
			positions[i * 2 + 1] = point.y;

			const matches = matchesFilters(point.item);
			const isLocked = lockedItem && point.item.id === lockedItem.id;
			const hue = (i * 137.508) % 360;

			isLockedArr[i] = isLocked ? 1.0 : 0.0;

			if (isLocked) {
				// Keep original color, shader will add white ring
				const [r, g, b] = hslToRgb(hue, 65, 55);
				colors[i * 3] = r;
				colors[i * 3 + 1] = g;
				colors[i * 3 + 2] = b;
				sizes[i] = 24.0;
			} else if (hasFilters && !matches) {
				colors[i * 3] = 0.16;
				colors[i * 3 + 1] = 0.16;
				colors[i * 3 + 2] = 0.2;
				sizes[i] = 6.0;
			} else if (hasFilters && matches) {
				colors[i * 3] = 0.77;
				colors[i * 3 + 1] = 0.77;
				colors[i * 3 + 2] = 1.0;
				sizes[i] = 15.0;
			} else {
				const [r, g, b] = hslToRgb(hue, 65, 55);
				colors[i * 3] = r;
				colors[i * 3 + 1] = g;
				colors[i * 3 + 2] = b;
				sizes[i] = 9.0;
			}
		});

		gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.position);
		gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

		gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.color);
		gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

		gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.size);
		gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);

		gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.isLocked);
		gl.bufferData(gl.ARRAY_BUFFER, isLockedArr, gl.STATIC_DRAW);
	}, [activeFilters, matchesFilters, data, lockedItem]);

	// Draw with WebGL
	const draw = useCallback(() => {
		const gl = glRef.current;
		const program = programRef.current;
		const canvas = canvasRef.current;
		if (!gl || !program || !canvas || !buffersRef.current.position) return;

		const { width, height } = canvas;
		gl.viewport(0, 0, width, height);
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.useProgram(program);

		// Set uniforms
		const resolutionLoc = gl.getUniformLocation(program, 'u_resolution');
		const translationLoc = gl.getUniformLocation(program, 'u_translation');
		const scaleLoc = gl.getUniformLocation(program, 'u_scale');

		gl.uniform2f(resolutionLoc, width / 2, height / 2);
		gl.uniform2f(translationLoc, transform.x, transform.y);
		gl.uniform1f(scaleLoc, transform.scale);

		// Position attribute
		const positionLoc = gl.getAttribLocation(program, 'a_position');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.position);
		gl.enableVertexAttribArray(positionLoc);
		gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

		// Color attribute
		const colorLoc = gl.getAttribLocation(program, 'a_color');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.color);
		gl.enableVertexAttribArray(colorLoc);
		gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

		// Size attribute
		const sizeLoc = gl.getAttribLocation(program, 'a_size');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.size);
		gl.enableVertexAttribArray(sizeLoc);
		gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, 0, 0);

		// IsLocked attribute
		const isLockedLoc = gl.getAttribLocation(program, 'a_isLocked');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.isLocked);
		gl.enableVertexAttribArray(isLockedLoc);
		gl.vertexAttribPointer(isLockedLoc, 1, gl.FLOAT, false, 0, 0);

		gl.drawArrays(gl.POINTS, 0, pointsRef.current.length);
	}, [transform]);

	// Resize handler
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const resize = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
			draw();
		};

		resize();
		window.addEventListener('resize', resize);
		return () => window.removeEventListener('resize', resize);
	}, [draw]);

	// Draw on transform change or selection change
	useEffect(() => {
		draw();
	}, [draw, transform, activeFilters, lockedItem]);

	// Find point at mouse position
	const findPointAtMouse = useCallback((e: React.MouseEvent): Point | null => {
		const canvas = canvasRef.current;
		if (!canvas) return null;

		const rect = canvas.getBoundingClientRect();
		// Scale mouse coordinates from CSS pixels to canvas buffer pixels
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;
		const canvasX = (e.clientX - rect.left) * scaleX;
		const canvasY = (e.clientY - rect.top) * scaleY;

		// Convert to world coordinates (inverse of shader transform)
		// Shader does: clip = (pos * scale + translation) / (resolution) * 2
		// where resolution = (width/2, height/2)
		// So: clip = (pos * scale + translation) * 4 / dimensions
		// Screen center (dimensions/2) maps to clip=0, so:
		// worldX * scale + transform.x = (screenX - width/2) / 2
		const mouseX = (canvasX - canvas.width / 2) / 2 - transform.x;
		const mouseY = (canvasY - canvas.height / 2) / 2 - transform.y;

		let closest: Point | null = null;
		let closestDist = Infinity;
		const threshold = 80 / transform.scale;

		for (const point of pointsRef.current) {
			const dx = point.x * transform.scale - mouseX;
			const dy = point.y * transform.scale - mouseY;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < threshold && dist < closestDist) {
				closest = point;
				closestDist = dist;
			}
		}

		return closest;
	}, [transform]);

	// Mouse handlers
	const handleMouseDown = (e: React.MouseEvent) => {
		setIsDragging(true);
		setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
		setClickStart({ x: e.clientX, y: e.clientY });
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (isDragging) {
			setTransform((prev) => ({
				...prev,
				x: e.clientX - dragStart.x,
				y: e.clientY - dragStart.y,
			}));
		} else {
			// Check for hover (only update if no locked item)
			const closest = findPointAtMouse(e);
			setHoveredItem(closest?.item || null);
		}
	};

	const handleMouseUp = (e: React.MouseEvent) => {
		// Check if this was a click (not a drag)
		if (clickStart) {
			const dx = e.clientX - clickStart.x;
			const dy = e.clientY - clickStart.y;
			const distance = Math.sqrt(dx * dx + dy * dy);

			if (distance < 5) {
				// This was a click, not a drag
				const closest = findPointAtMouse(e);
				if (closest) {
					// Toggle lock on this item
					if (lockedItem && lockedItem.id === closest.item.id) {
						setLockedItem(null);
					} else {
						setLockedItem(closest.item);
					}
				} else {
					// Clicked empty space, unlock
					setLockedItem(null);
				}
			}
		}

		setIsDragging(false);
		setClickStart(null);
	};

	const handleMouseLeave = () => {
		setIsDragging(false);
		setClickStart(null);
	};

	const handleWheel = (e: React.WheelEvent) => {
		e.preventDefault();
		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		// Scale mouse coordinates from CSS pixels to canvas buffer pixels
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;
		const canvasX = (e.clientX - rect.left) * scaleX;
		const canvasY = (e.clientY - rect.top) * scaleY;

		// Convert to world space (matching shader transform)
		const mouseX = (canvasX - canvas.width / 2) / 2;
		const mouseY = (canvasY - canvas.height / 2) / 2;

		const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
		const newScale = Math.max(0.1, Math.min(100, transform.scale * scaleFactor));

		const scaleRatio = newScale / transform.scale;
		const newX = mouseX - (mouseX - transform.x) * scaleRatio;
		const newY = mouseY - (mouseY - transform.y) * scaleRatio;

		setTransform({
			x: newX,
			y: newY,
			scale: newScale,
		});
	};

	// The item to display (locked takes priority over hovered)
	const displayItem = lockedItem || hoveredItem;

	const toggleFilter = (type: Filter['type'], value: string) => {
		setActiveFilters((prev) => {
			const exists = prev.some((f) => f.type === type && f.value === value);
			if (exists) {
				return prev.filter((f) => !(f.type === type && f.value === value));
			}
			return [...prev, { type, value }];
		});
	};

	const clearFilters = () => {
		setActiveFilters([]);
		setSearchTerm('');
	};

	const filteredAuthors = authors.filter((a) => a.toLowerCase().includes(searchTerm.toLowerCase()));
	const filteredBooks = books.filter((b) => b.toLowerCase().includes(searchTerm.toLowerCase()));
	const filteredReligions = religions.filter((r) => r.toLowerCase().includes(searchTerm.toLowerCase()));

	return (
		<div className="w-full h-screen relative bg-black">
			<canvas
				ref={canvasRef}
				className="w-full h-full cursor-crosshair"
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseLeave}
				onWheel={handleWheel}
			/>

			{/* Filter panel */}
			{showFilters && (
				<div className="fixed top-16 right-4 z-50 bg-black/95 border border-white/10 backdrop-blur-sm p-4 rounded-lg max-w-xs w-80 max-h-[70vh] overflow-hidden flex flex-col">
					<div className="flex items-center justify-between mb-3">
						<span className="text-white font-mono text-xs tracking-wider uppercase">FILTERS</span>
						{activeFilters.length > 0 && (
							<button onClick={clearFilters} className="text-white/60 hover:text-accent text-[10px] font-mono tracking-wider uppercase transition-colors">
								CLEAR ALL
							</button>
						)}
					</div>

					<input
						type="text"
						placeholder="SEARCH..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded text-white text-xs font-mono mb-3 placeholder-white/30 focus:border-accent focus:outline-none transition-colors"
					/>

					<div className="flex-1 overflow-y-auto space-y-4">
						{/* Active filters */}
						{activeFilters.length > 0 && (
							<div className="flex flex-wrap gap-2 pb-3 border-b border-white/10">
								{activeFilters.map((filter, i) => (
									<button
										key={i}
										onClick={() => toggleFilter(filter.type, filter.value)}
										className="bg-accent text-white px-2 py-1 rounded text-[10px] font-mono tracking-wide flex items-center gap-1 hover:bg-accent/80 transition-colors">
										{filter.value.toUpperCase()}
										<span className="opacity-70">×</span>
									</button>
								))}
							</div>
						)}

						{/* Religions */}
						{filteredReligions.length > 0 && (
							<div>
								<p className="text-white/50 text-[10px] font-mono tracking-wider uppercase mb-2">RELIGION</p>
								<div className="space-y-0.5 max-h-32 overflow-y-auto">
									{filteredReligions.map((religion) => (
										<button
											key={religion}
											onClick={() => toggleFilter('religion', religion)}
											className={`block w-full text-left px-2 py-1.5 rounded text-xs font-mono transition-colors ${
												activeFilters.some((f) => f.type === 'religion' && f.value === religion)
													? 'bg-accent text-white'
													: 'text-white/70 hover:bg-white/5 hover:text-white'
											}`}>
											{religion}
										</button>
									))}
								</div>
							</div>
						)}

						{/* Authors */}
						<div>
							<p className="text-white/50 text-[10px] font-mono tracking-wider uppercase mb-2">AUTHORS</p>
							<div className="space-y-0.5 max-h-40 overflow-y-auto">
								{filteredAuthors.slice(0, 50).map((author) => (
									<button
										key={author}
										onClick={() => toggleFilter('author', author)}
										className={`block w-full text-left px-2 py-1.5 rounded text-xs font-mono transition-colors ${
											activeFilters.some((f) => f.type === 'author' && f.value === author)
												? 'bg-accent text-white'
												: 'text-white/70 hover:bg-white/5 hover:text-white'
										}`}>
										{author}
									</button>
								))}
								{filteredAuthors.length > 50 && (
									<p className="text-white/30 text-[10px] font-mono px-2 py-1">+{filteredAuthors.length - 50} MORE</p>
								)}
							</div>
						</div>

						{/* Books */}
						<div>
							<p className="text-white/50 text-[10px] font-mono tracking-wider uppercase mb-2">BOOKS</p>
							<div className="space-y-0.5 max-h-40 overflow-y-auto">
								{filteredBooks.slice(0, 50).map((book) => (
									<button
										key={book}
										onClick={() => toggleFilter('book', book)}
										className={`block w-full text-left px-2 py-1.5 rounded text-xs font-mono transition-colors ${
											activeFilters.some((f) => f.type === 'book' && f.value === book)
												? 'bg-accent text-white'
												: 'text-white/70 hover:bg-white/5 hover:text-white'
										}`}>
										{book}
									</button>
								))}
								{filteredBooks.length > 50 && (
									<p className="text-white/30 text-[10px] font-mono px-2 py-1">+{filteredBooks.length - 50} MORE</p>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Selected quote */}
			{displayItem && (
				<div className="fixed bottom-4 right-4 z-40 bg-black/95 border border-white/10 backdrop-blur-sm p-5 rounded-lg max-w-md text-white">
					{displayItem.religion && (
						<button
							onClick={() => displayItem.religion && toggleFilter('religion', displayItem.religion)}
							className="text-[10px] font-mono tracking-wider uppercase text-accent hover:text-accent2 transition-colors mb-2 block">
							{displayItem.religion}
						</button>
					)}
					<p className="mb-4 text-sm leading-relaxed font-serif italic text-white/90">&ldquo;{displayItem.text}&rdquo;</p>
					<div className="text-right">
						<button
							onClick={() => displayItem.author && toggleFilter('author', displayItem.author)}
							className="text-xs font-mono tracking-wider uppercase hover:text-accent transition-colors">
							{displayItem.author}
						</button>
						{displayItem.book && (
							<button
								onClick={() => toggleFilter('book', displayItem.book)}
								className="text-xs font-mono text-white/50 ml-2 hover:text-accent transition-colors">
								{displayItem.book}
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
