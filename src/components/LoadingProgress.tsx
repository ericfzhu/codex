interface LoadingProgressProps {
	label: string;
	progress: number;
	barClassName?: string;
}

export default function LoadingProgress({ label, progress, barClassName = 'bg-accent' }: LoadingProgressProps) {
	const roundedProgress = Math.round(progress);

	return (
		<div className="flex-1 flex items-center justify-center px-6 text-gray-500 dark:text-gray-400" role="status" aria-live="polite">
			<div className="w-full max-w-sm">
				<div className="mb-3 flex items-center justify-between gap-4 text-xs sm:text-sm">
					<span>{label}</span>
					<span className="tabular-nums" aria-hidden="true">{roundedProgress}%</span>
				</div>
				<div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
					<div
						className={`h-full rounded-full ${barClassName} transition-[width] duration-200 ease-out`}
						style={{ width: `${roundedProgress}%` }}
					/>
				</div>
			</div>
		</div>
	);
}
