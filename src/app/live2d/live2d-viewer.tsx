'use client'

import { useEffect, useRef, useState } from 'react'

/** PIXI Application 实例（CDN 加载，无类型包） */
interface PixiAppInstance {
	stage: { addChild: (child: unknown) => void }
	view: HTMLCanvasElement
	destroy: (opts?: { removeView?: boolean }) => void
}

/** Live2D 模型实例 */
interface Live2DModelInstance {
	anchor: { set: (x: number, y: number) => void }
	x: number
	y: number
	width: number
	height: number
	scale: { set: (x: number, y: number) => void }
	motion: (group: string, index?: number) => unknown
}

const CDN_SCRIPTS = [
	'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/6.2.0/browser/pixi.min.js',
	'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
	'https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/cubism4.min.js'
]

const MODEL_URL = '/live2d/haru.model3.json'

/** Haru 模型的动作组（对应 haru.model3.json 的 Motions 分组） */
const MOTION_GROUPS = [
	{ key: 'Idle', label: '待机' },
	{ key: 'Tap', label: '点击' },
	{ key: 'Flick', label: '轻扫' },
	{ key: 'FlickRight', label: '右扫' },
	{ key: 'FlickLeft', label: '左扫' },
	{ key: 'Flick3', label: '轻扫③' },
	{ key: 'Shake', label: '摇晃' }
] as const

const SCALE_MIN = 0.3
const SCALE_MAX = 2
const SCALE_STEP = 0.05

function loadScript(src: string): Promise<void> {
	return new Promise((resolve, reject) => {
		if (document.querySelector(`script[src="${src}"]`)) {
			resolve()
			return
		}
		const script = document.createElement('script')
		script.src = src
		script.crossOrigin = 'anonymous'
		script.onload = () => resolve()
		script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
		document.head.appendChild(script)
	})
}

export default function Live2DViewer() {
	const containerRef = useRef<HTMLDivElement>(null)
	const modelRef = useRef<Live2DModelInstance | null>(null)
	const baseFitRef = useRef(1)
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
	const [errorMsg, setErrorMsg] = useState<string>('')
	const [scale, setScale] = useState(1)

	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		let app: PixiAppInstance | null = null

		const init = async () => {
			try {
				for (const src of CDN_SCRIPTS) {
					await loadScript(src)
				}

				const PIXI = (window as unknown as { PIXI: unknown }).PIXI
				if (!PIXI) {
					throw new Error('PIXI not found on window')
				}
				;(window as unknown as { PIXI: unknown }).PIXI = PIXI

				const PIXIApp = (
					PIXI as { Application: new (opts: { view: HTMLCanvasElement; width?: number; height?: number; backgroundAlpha?: number }) => PixiAppInstance }
				).Application

				const Live2DModel = (PIXI as { live2d?: { Live2DModel: { from: (url: string) => Promise<Live2DModelInstance> } } }).live2d?.Live2DModel

				if (!Live2DModel) {
					throw new Error('PIXI.live2d.Live2DModel not found')
				}

				const width = container.clientWidth || 500
				const height = container.clientHeight || 500
				const canvas = document.createElement('canvas')
				canvas.style.width = '100%'
				canvas.style.height = '100%'
				canvas.style.display = 'block'
				container.appendChild(canvas)

				app = new PIXIApp({
					view: canvas,
					width,
					height,
					backgroundAlpha: 0
				})

				const model = await Live2DModel.from(MODEL_URL)
				app.stage.addChild(model)

				model.anchor.set(0.5, 0.5)
				model.x = width / 2
				model.y = height / 2

				// 自适应缩放：按模型实际尺寸适配容器，留约 8% 边距
				const fit = Math.min(width / (model.width || 1), height / (model.height || 1)) * 0.92
				baseFitRef.current = fit
				model.scale.set(fit, fit)

				modelRef.current = model
				setStatus('ready')
			} catch (err) {
				setErrorMsg(err instanceof Error ? err.message : String(err))
				setStatus('error')
			}
		}

		init()

		return () => {
			if (app !== null && typeof app === 'object' && 'destroy' in app && typeof app.destroy === 'function') {
				app.destroy({ removeView: true })
			}
			modelRef.current = null
			container.innerHTML = ''
		}
	}, [])

	const handleScaleChange = (value: number) => {
		setScale(value)
		const model = modelRef.current
		if (model) {
			model.scale.set(baseFitRef.current * value, baseFitRef.current * value)
		}
	}

	const handleMotion = (group: string) => {
		const model = modelRef.current
		if (!model) return
		try {
			model.motion(group)
		} catch {
			// 动作组不存在时忽略
		}
	}

	const isReady = status === 'ready'

	return (
		<div className='flex flex-col items-center gap-6'>
			<div className='relative aspect-square w-full max-w-[420px] overflow-hidden rounded-full'>
				<div ref={containerRef} className='absolute inset-0 h-full w-full' />
				{status === 'loading' && <div className='text-secondary absolute inset-0 flex items-center justify-center'>加载 Live2D 模型中…</div>}
				{status === 'error' && <div className='absolute inset-0 flex items-center justify-center p-4 text-center text-red-500'>{errorMsg}</div>}
			</div>

			{isReady && (
				<div className='flex w-full max-w-[420px] flex-col gap-4'>
					<label className='flex flex-col gap-2'>
						<span className='text-secondary text-sm'>大小（{scale.toFixed(2)}×）</span>
						<input
							type='range'
							min={SCALE_MIN}
							max={SCALE_MAX}
							step={SCALE_STEP}
							value={scale}
							onChange={(e) => handleScaleChange(Number(e.target.value))}
							className='w-full'
							style={{ accentColor: 'var(--color-brand)' }}
						/>
					</label>

					<div className='flex flex-wrap justify-center gap-2'>
						{MOTION_GROUPS.map((group) => (
							<button
								key={group.key}
								type='button'
								onClick={() => handleMotion(group.key)}
								className='rounded-full border border-[var(--color-brand)] px-3 py-1 text-sm text-[var(--color-primary)] transition-colors hover:bg-[var(--color-brand)] hover:text-white'
							>
								{group.label}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
