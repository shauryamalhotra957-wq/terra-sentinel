import { useMemo, useState, type ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BellRing,
  ClipboardCopy,
  Download,
  Droplets,
  HeartPulse,
  MapPin,
  RadioTower,
  RefreshCw,
  Route,
  ShieldAlert,
  Siren,
  SlidersHorizontal,
  UsersRound,
  Waves,
  Wind,
  Zap,
} from 'lucide-react'
import './App.css'
import { defaultScenario, incidents, lifelineDefinitions, scenarioPresets } from './domain/data'
import {
  allocateResources,
  assessCity,
  createBriefingPacket,
  equityScore,
  generateWarnings,
  riskColor,
  simulateForecast,
  summarizeCoverage,
} from './domain/engine'
import { allocationsToCsv, districtsToCsv, downloadText, packetToJson } from './domain/exporters'
import type {
  AllocationRecommendation,
  CityAssessment,
  DistrictAssessment,
  ForecastPoint,
  LifelineStatus,
  ScenarioControls,
  Severity,
  WarningMessage,
} from './domain/types'

type ExperienceMode = 'simple' | 'expert'

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(Math.round(value))

const severityCopy: Record<Severity, string> = {
  stable: 'Stable',
  guarded: 'Guarded',
  elevated: 'Elevated',
  severe: 'Severe',
  critical: 'Critical',
}

const controlMeta: Array<{
  key: keyof ScenarioControls
  label: string
  unit: string
  min: number
  max: number
  step: number
  icon: ReactNode
}> = [
  {
    key: 'rainfallMm',
    label: 'Rainfall',
    unit: 'mm',
    min: 0,
    max: 240,
    step: 2,
    icon: <Droplets size={18} />,
  },
  {
    key: 'riverLevelM',
    label: 'River level',
    unit: 'm',
    min: 0,
    max: 8,
    step: 0.1,
    icon: <Waves size={18} />,
  },
  {
    key: 'windKph',
    label: 'Wind',
    unit: 'kph',
    min: 0,
    max: 180,
    step: 2,
    icon: <Wind size={18} />,
  },
  {
    key: 'heatIndexC',
    label: 'Heat index',
    unit: 'C',
    min: 24,
    max: 50,
    step: 0.5,
    icon: <HeartPulse size={18} />,
  },
  {
    key: 'commsOutagePercent',
    label: 'Comms outage',
    unit: '%',
    min: 0,
    max: 100,
    step: 1,
    icon: <RadioTower size={18} />,
  },
  {
    key: 'hospitalLoadPercent',
    label: 'Hospital load',
    unit: '%',
    min: 10,
    max: 100,
    step: 1,
    icon: <Activity size={18} />,
  },
  {
    key: 'trafficBlockagePercent',
    label: 'Blocked roads',
    unit: '%',
    min: 0,
    max: 100,
    step: 1,
    icon: <Route size={18} />,
  },
  {
    key: 'forecastHours',
    label: 'Forecast horizon',
    unit: 'h',
    min: 3,
    max: 12,
    step: 1,
    icon: <SlidersHorizontal size={18} />,
  },
]

const essentialControlKeys = new Set<keyof ScenarioControls>([
  'rainfallMm',
  'riverLevelM',
  'heatIndexC',
  'trafficBlockagePercent',
])

function MetricTile({
  icon,
  label,
  value,
  detail,
  severity,
}: {
  icon: ReactNode
  label: string
  value: string
  detail: string
  severity?: Severity
}) {
  return (
    <article className={`metric-tile ${severity ? `severity-${severity}` : ''}`}>
      <div className="metric-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  )
}

function ScenarioSlider({
  controls,
  setControls,
  meta,
}: {
  controls: ScenarioControls
  setControls: (next: ScenarioControls) => void
  meta: (typeof controlMeta)[number]
}) {
  const value = controls[meta.key]
  return (
    <label className="control-row">
      <span className="control-heading">
        <span className="control-icon">{meta.icon}</span>
        <span>{meta.label}</span>
        <output>
          {value}
          {meta.unit}
        </output>
      </span>
      <input
        aria-label={meta.label}
        type="range"
        min={meta.min}
        max={meta.max}
        step={meta.step}
        value={value}
        onChange={(event) =>
          setControls({
            ...controls,
            [meta.key]: Number(event.target.value),
          })
        }
      />
    </label>
  )
}

function SeverityPill({ severity }: { severity: Severity }) {
  return <span className={`severity-pill severity-${severity}`}>{severityCopy[severity]}</span>
}

function ModeToggle({
  mode,
  onModeChange,
}: {
  mode: ExperienceMode
  onModeChange: (mode: ExperienceMode) => void
}) {
  return (
    <div className="mode-toggle" role="group" aria-label="View density">
      <button
        type="button"
        aria-pressed={mode === 'simple'}
        className={mode === 'simple' ? 'active' : ''}
        onClick={() => onModeChange('simple')}
      >
        <BadgeCheck size={15} />
        Simple
      </button>
      <button
        type="button"
        aria-pressed={mode === 'expert'}
        className={mode === 'expert' ? 'active' : ''}
        onClick={() => onModeChange('expert')}
      >
        <SlidersHorizontal size={15} />
        Expert
      </button>
    </div>
  )
}

function RiskMap({
  city,
  selectedId,
  onSelect,
}: {
  city: CityAssessment
  selectedId: string
  onSelect: (districtId: string) => void
}) {
  const getLabel = (assessment: DistrictAssessment) =>
    `${assessment.district.name}: ${assessment.score} risk, ${severityCopy[assessment.severity]}`

  return (
    <div className="map-frame">
      <svg viewBox="0 0 104 104" role="group" aria-label="Terra Sentinel district risk map">
        <defs>
          <pattern id="map-grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#d8ded5" strokeWidth="0.28" />
          </pattern>
          <filter id="district-shadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#1d2a24" floodOpacity="0.16" />
          </filter>
        </defs>
        <rect x="1" y="1" width="102" height="102" rx="3" fill="#f3f6ee" />
        <rect x="1" y="1" width="102" height="102" rx="3" fill="url(#map-grid)" opacity="0.82" />
        <path
          className="river-path"
          d="M3,67 C20,63 24,45 42,47 C58,50 63,65 79,66 C91,66 96,57 102,54"
        />
        {city.districts.map((assessment) => {
          const selected = assessment.district.id === selectedId
          return (
            <g
              key={assessment.district.id}
              role="button"
              tabIndex={0}
              aria-label={getLabel(assessment)}
              onClick={() => onSelect(assessment.district.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(assessment.district.id)
                }
              }}
              className={selected ? 'district selected' : 'district'}
            >
              <title>{getLabel(assessment)}</title>
              <polygon
                points={assessment.district.polygon}
                fill={riskColor(assessment.score)}
                filter="url(#district-shadow)"
              />
              <circle
                cx={assessment.district.coordinates.x}
                cy={assessment.district.coordinates.y}
                r={selected ? 4.6 : 3.6}
              />
              <text x={assessment.district.coordinates.x} y={assessment.district.coordinates.y + 1.4}>
                {Math.round(assessment.score)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function LifelineGrid({ lifelines }: { lifelines: LifelineStatus[] }) {
  return (
    <div className="lifeline-grid">
      {lifelines.map((lifeline) => {
        const belowThreshold = lifeline.value < lifeline.criticalThreshold
        return (
          <article key={lifeline.key} className={belowThreshold ? 'lifeline at-risk' : 'lifeline'}>
            <div className="lifeline-topline">
              <strong>{lifelineDefinitions.find((item) => item.key === lifeline.key)?.shortLabel}</strong>
              <span>{lifeline.value}%</span>
            </div>
            <div className="bar-track" aria-hidden="true">
              <span style={{ width: `${lifeline.value}%` }} />
            </div>
          </article>
        )
      })}
    </div>
  )
}

function AllocationTable({
  recommendations,
  limit = 7,
}: {
  recommendations: AllocationRecommendation[]
  limit?: number
}) {
  return (
    <div className="allocation-list">
      {recommendations.slice(0, limit).map((recommendation) => (
        <article key={recommendation.id} className="allocation-row">
          <div>
            <strong>{recommendation.resourceLabel}</strong>
            <span>{recommendation.districtName}</span>
          </div>
          <div className="allocation-metrics">
            <span>{recommendation.units}u</span>
            <span>{recommendation.etaMinutes}m</span>
            <span>{formatNumber(recommendation.peopleCovered)}</span>
          </div>
        </article>
      ))}
    </div>
  )
}

function WarningPanel({
  messages,
  onCopy,
  copied,
}: {
  messages: WarningMessage[]
  onCopy: () => void
  copied: boolean
}) {
  return (
    <div className="warning-stack">
      <div className="panel-action-row">
        <span>{messages.length} channel-ready messages</span>
        <button type="button" className="ghost-button" onClick={onCopy}>
          <ClipboardCopy size={16} />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {messages.map((message) => (
        <article key={`${message.channel}-${message.language}`} className="warning-card">
          <div className="warning-head">
            <strong>{message.channel.replace('-', ' ')}</strong>
            <span>{message.language}</span>
          </div>
          <p>{message.body}</p>
          <code>{message.checksum}</code>
        </article>
      ))}
    </div>
  )
}

function IncidentStream() {
  return (
    <div className="incident-stream">
      {incidents
        .slice()
        .sort((a, b) => a.minutesAgo - b.minutesAgo)
        .map((incident) => (
          <article key={incident.id} className="incident">
            <span className={`incident-severity s${incident.severity}`}>{incident.severity}</span>
            <div>
              <strong>{incident.title}</strong>
              <p>{incident.summary}</p>
              <span>
                {incident.channel} | {incident.minutesAgo}m | {Math.round(incident.confidence * 100)}%
              </span>
            </div>
          </article>
        ))}
    </div>
  )
}

function ForecastChart({ forecast }: { forecast: ForecastPoint[] }) {
  const width = 420
  const height = 230
  const padding = { left: 34, right: 18, top: 18, bottom: 34 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const denominator = Math.max(forecast.length - 1, 1)
  const points = forecast.map((point, index) => ({
    x: padding.left + (index / denominator) * plotWidth,
    y: padding.top + (1 - point.averageRisk / 100) * plotHeight,
    ...point,
  }))
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ')
  const areaPath = `${linePath} L${points.at(-1)?.x ?? padding.left},${height - padding.bottom} L${padding.left},${height - padding.bottom} Z`

  return (
    <svg className="forecast-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Forecast risk chart">
      {[25, 50, 75].map((tick) => {
        const y = padding.top + (1 - tick / 100) * plotHeight
        return (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
            <text x={12} y={y + 4}>
              {tick}
            </text>
          </g>
        )
      })}
      <path className="forecast-area" d={areaPath} />
      <path className="forecast-line" d={linePath} />
      {points.map((point) => (
        <g key={point.hour}>
          <circle cx={point.x} cy={point.y} r="3.5" />
          {point.hour === 0 || point.hour === forecast.at(-1)?.hour ? (
            <text className="chart-hour" x={point.x} y={height - 10}>
              {point.hour}h
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  )
}

function CityLifelineChart({ lifelines }: { lifelines: LifelineStatus[] }) {
  const width = 420
  const height = 160
  const gap = 12
  const barWidth = (width - 42 - gap * (lifelines.length - 1)) / lifelines.length
  const baseline = 132

  return (
    <svg className="lifeline-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="City lifeline average chart">
      <line x1="20" x2={width - 12} y1={baseline} y2={baseline} />
      {lifelines.map((lifeline, index) => {
        const x = 20 + index * (barWidth + gap)
        const barHeight = Math.max(8, lifeline.value * 1.05)
        const y = baseline - barHeight
        const atRisk = lifeline.value < lifeline.criticalThreshold

        return (
          <g key={lifeline.key}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="5"
              fill={atRisk ? '#ad1f3b' : '#2d8b73'}
            />
            <text x={x + barWidth / 2} y={y - 6}>
              {Math.round(lifeline.value)}
            </text>
            <text className="lifeline-short-label" x={x + barWidth / 2} y={height - 8}>
              {lifelineDefinitions.find((item) => item.key === lifeline.key)?.shortLabel}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function App() {
  const [controls, setControls] = useState<ScenarioControls>(defaultScenario.controls)
  const [presetId, setPresetId] = useState(defaultScenario.id)
  const [selectedDistrictId, setSelectedDistrictId] = useState('south-flats')
  const [mode, setMode] = useState<ExperienceMode>('simple')
  const [copied, setCopied] = useState(false)

  const city = useMemo(() => assessCity(controls), [controls])
  const selectedDistrict =
    city.districts.find((assessment) => assessment.district.id === selectedDistrictId) ?? city.districts[0]
  const topDistrict = city.districts[0]
  const recommendations = useMemo(() => allocateResources(city), [city])
  const forecast = useMemo(() => simulateForecast(controls), [controls])
  const warningMessages = useMemo(
    () => generateWarnings(selectedDistrict, controls),
    [selectedDistrict, controls],
  )
  const priorityWarnings = useMemo(() => generateWarnings(topDistrict, controls), [topDistrict, controls])
  const coverage = useMemo(() => summarizeCoverage(recommendations), [recommendations])
  const equity = useMemo(() => equityScore(city, recommendations), [city, recommendations])
  const packet = useMemo(
    () => createBriefingPacket(controls, city, selectedDistrict, recommendations, warningMessages),
    [city, controls, recommendations, selectedDistrict, warningMessages],
  )

  const primaryMove = recommendations[0]
  const primaryWarning = priorityWarnings[0]
  const essentialControls = controlMeta.filter((meta) => essentialControlKeys.has(meta.key))
  const applyPreset = (id: string) => {
    const preset = scenarioPresets.find((item) => item.id === id) ?? defaultScenario
    setPresetId(preset.id)
    setControls(preset.controls)
  }

  const copyWarnings = async () => {
    const body = warningMessages
      .map((message) => `[${message.channel}/${message.language}/${message.checksum}] ${message.body}`)
      .join('\n\n')
    await navigator.clipboard?.writeText(body)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <main className="app-shell">
      <div className="terra-entry" aria-hidden="true">
        <div>
          <span>Terra Sentinel</span>
          <strong>Lifeline command opening</strong>
        </div>
      </div>
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">
            <ShieldAlert size={28} />
          </span>
          <div>
            <p>Terra Sentinel</p>
            <h1>Humanitarian Risk Command Center</h1>
          </div>
        </div>
        <div className="header-actions">
          <ModeToggle mode={mode} onModeChange={setMode} />
          <button type="button" className="ghost-button" onClick={() => applyPreset(defaultScenario.id)}>
            <RefreshCw size={16} />
            Reset
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => downloadText('terra-sentinel-briefing.json', packetToJson(packet), 'application/json')}
          >
            <Download size={16} />
            Export packet
          </button>
        </div>
      </header>

      <section className="command-strip" aria-label="Current response context">
        <article>
          <span>Top district</span>
          <strong>{topDistrict.district.name}</strong>
        </article>
        <article>
          <span>Severity</span>
          <strong>{severityCopy[topDistrict.severity]}</strong>
        </article>
        <article>
          <span>First move</span>
          <strong>{primaryMove.resourceLabel}</strong>
        </article>
        <article>
          <span>Warnings</span>
          <strong>{priorityWarnings.length} ready</strong>
        </article>
      </section>

      <section className="metric-strip" aria-label="Current city risk summary">
        <MetricTile
          icon={<Siren size={22} />}
          label="City risk"
          value={`${city.averageRisk}/100`}
          detail={`${city.criticalCount} severe districts`}
          severity={topDistrict.severity}
        />
        <MetricTile
          icon={<UsersRound size={22} />}
          label="Exposed population"
          value={formatNumber(city.exposedPopulation)}
          detail={`${formatNumber(city.estimatedShelterDemand)} shelter demand`}
        />
        <MetricTile
          icon={<BadgeCheck size={22} />}
          label="Coverage"
          value={formatNumber(coverage.peopleCovered)}
          detail={`${coverage.responseUnits} units | ${coverage.medianEta}m median ETA`}
        />
        <MetricTile
          icon={<Zap size={22} />}
          label="Equity guardrail"
          value={`${equity}%`}
          detail="high-vulnerability wards covered"
        />
      </section>

      {mode === 'simple' ? (
        <section className="simple-experience">
          <section className="panel simple-controls-panel">
            <div className="panel-heading">
              <div>
                <p>Scenario</p>
                <h2>Set the situation</h2>
              </div>
              <SlidersHorizontal size={20} />
            </div>
            <div className="preset-strip">
              {scenarioPresets.map((preset) => (
                <button
                  type="button"
                  key={preset.id}
                  className={presetId === preset.id ? 'preset-button active' : 'preset-button'}
                  onClick={() => applyPreset(preset.id)}
                  title={preset.summary}
                >
                  {preset.name}
                </button>
              ))}
            </div>
            <div className="essential-controls">
              {essentialControls.map((meta) => (
                <ScenarioSlider key={meta.key} meta={meta} controls={controls} setControls={setControls} />
              ))}
            </div>
          </section>

          <section className="simple-grid">
            <section className="panel priority-panel">
              <div className="panel-heading">
                <div>
                  <p>Priority Brief</p>
                  <h2>{topDistrict.district.name}</h2>
                </div>
                <SeverityPill severity={topDistrict.severity} />
              </div>
              <div className="priority-body">
                <div className="priority-score">
                  <strong>{topDistrict.score}</strong>
                  <span>risk score</span>
                </div>
                <article className="priority-action">
                  <span>Do first</span>
                  <strong>
                    {primaryMove
                      ? `${primaryMove.units} ${primaryMove.resourceLabel} to ${primaryMove.districtName}`
                      : 'Keep monitoring'}
                  </strong>
                  <p>{primaryMove?.rationale ?? 'No immediate resource move is required for this scenario.'}</p>
                </article>
                <div className="priority-chips">
                  {topDistrict.primaryDrivers.map((driver) => (
                    <span key={driver}>{driver}</span>
                  ))}
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setSelectedDistrictId(topDistrict.district.id)}
                >
                  <MapPin size={16} />
                  Focus map
                </button>
              </div>
            </section>

            <section className="panel map-panel simple-map-panel">
              <div className="panel-heading">
                <div>
                  <p>Map</p>
                  <h2>{selectedDistrict.district.name}</h2>
                </div>
                <SeverityPill severity={selectedDistrict.severity} />
              </div>
              <RiskMap city={city} selectedId={selectedDistrict.district.id} onSelect={setSelectedDistrictId} />
              <div className="selected-summary">
                <article>
                  <span>Risk</span>
                  <strong>{selectedDistrict.score}</strong>
                </article>
                <article>
                  <span>Shelter need</span>
                  <strong>{formatNumber(selectedDistrict.expectedShelterDemand)}</strong>
                </article>
                <article>
                  <span>Driver</span>
                  <strong>{selectedDistrict.primaryDrivers[0]}</strong>
                </article>
              </div>
            </section>

            <section className="panel next-panel">
              <div className="panel-heading">
                <div>
                  <p>Next Moves</p>
                  <h2>Act now</h2>
                </div>
                <Siren size={20} />
              </div>
              <AllocationTable recommendations={recommendations} limit={3} />
              <article className="simple-warning">
                <span>Public warning</span>
                <p>{primaryWarning.body}</p>
                <code>{primaryWarning.checksum}</code>
              </article>
            </section>
          </section>
        </section>
      ) : (
        <section className="workspace-grid">
        <aside className="panel scenario-panel">
          <div className="panel-heading">
            <div>
              <p>Scenario Lab</p>
              <h2>Stress the city</h2>
            </div>
            <SlidersHorizontal size={20} />
          </div>
          <div className="preset-grid">
            {scenarioPresets.map((preset) => (
              <button
                type="button"
                key={preset.id}
                className={presetId === preset.id ? 'preset-button active' : 'preset-button'}
                onClick={() => applyPreset(preset.id)}
                title={preset.summary}
              >
                {preset.name}
              </button>
            ))}
          </div>
          <div className="control-stack">
            {controlMeta.map((meta) => (
              <ScenarioSlider key={meta.key} meta={meta} controls={controls} setControls={setControls} />
            ))}
          </div>
        </aside>

        <section className="panel map-panel">
          <div className="panel-heading">
            <div>
              <p>Operational Map</p>
              <h2>{selectedDistrict.district.name}</h2>
            </div>
            <SeverityPill severity={selectedDistrict.severity} />
          </div>
          <RiskMap city={city} selectedId={selectedDistrict.district.id} onSelect={setSelectedDistrictId} />
          <div className="selected-summary">
            <article>
              <span>Risk</span>
              <strong>{selectedDistrict.score}</strong>
            </article>
            <article>
              <span>Population</span>
              <strong>{formatNumber(selectedDistrict.district.population)}</strong>
            </article>
            <article>
              <span>Shelter gap</span>
              <strong>{formatNumber(selectedDistrict.expectedShelterDemand)}</strong>
            </article>
            <article>
              <span>Primary driver</span>
              <strong>{selectedDistrict.primaryDrivers[0]}</strong>
            </article>
          </div>
        </section>

        <section className="panel lifeline-panel">
          <div className="panel-heading">
            <div>
              <p>FEMA Lifelines</p>
              <h2>Stabilization status</h2>
            </div>
            <AlertTriangle size={20} />
          </div>
          <LifelineGrid lifelines={selectedDistrict.lifelines} />
          <div className="driver-list">
            {selectedDistrict.primaryDrivers.map((driver) => (
              <span key={driver}>{driver}</span>
            ))}
          </div>
        </section>

        <section className="panel forecast-panel">
          <div className="panel-heading">
            <div>
              <p>Forecast</p>
              <h2>{controls.forecastHours}-hour outlook</h2>
            </div>
            <Activity size={20} />
          </div>
          <ForecastChart forecast={forecast} />
        </section>

        <section className="panel allocation-panel">
          <div className="panel-heading">
            <div>
              <p>Optimization</p>
              <h2>Resource moves</h2>
            </div>
            <button
              type="button"
              className="icon-only-button"
              aria-label="Download allocations CSV"
              title="Download allocations CSV"
              onClick={() =>
                downloadText('terra-sentinel-allocations.csv', allocationsToCsv(recommendations), 'text/csv')
              }
            >
              <Download size={17} />
            </button>
          </div>
          <AllocationTable recommendations={recommendations} />
        </section>

        <section className="panel warnings-panel">
          <div className="panel-heading">
            <div>
              <p>Public Warning</p>
              <h2>Trusted messages</h2>
            </div>
            <BellRing size={20} />
          </div>
          <WarningPanel messages={warningMessages} onCopy={copyWarnings} copied={copied} />
        </section>

        <section className="panel incident-panel">
          <div className="panel-heading">
            <div>
              <p>Signals</p>
              <h2>Incident stream</h2>
            </div>
            <MapPin size={20} />
          </div>
          <IncidentStream />
        </section>

        <section className="panel evidence-panel">
          <div className="panel-heading">
            <div>
              <p>Explainability</p>
              <h2>Why the model acts</h2>
            </div>
            <button
              type="button"
              className="icon-only-button"
              aria-label="Download district CSV"
              title="Download district CSV"
              onClick={() => downloadText('terra-sentinel-districts.csv', districtsToCsv(city.districts), 'text/csv')}
            >
              <Download size={17} />
            </button>
          </div>
          <div className="evidence-grid">
            {city.topDrivers.map((driver, index) => (
              <article key={driver}>
                <span>#{index + 1}</span>
                <strong>{driver}</strong>
              </article>
            ))}
          </div>
          <CityLifelineChart lifelines={city.lifelineAverages} />
        </section>
      </section>
      )}
      <footer className="terra-footer">
        <div>
          <strong>Terra Sentinel</strong>
          <span>Humanitarian response surface for lifelines, warnings, allocations, and explainable risk.</span>
        </div>
        <nav aria-label="Footer status">
          <span>{mode} mode</span>
          <span>{formatNumber(coverage.peopleCovered)} covered</span>
          <span>Equity {equity}%</span>
        </nav>
      </footer>
    </main>
  )
}

export default App
