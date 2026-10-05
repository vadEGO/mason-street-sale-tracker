export const dynamic = 'force-dynamic'

const base = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

async function table(name: string, order?: string) {
  if (!base || !key) throw new Error('Supabase environment variables are not configured')
  const url = new URL(base + '/rest/v1/' + name)
  url.searchParams.set('select', '*')
  if (order) url.searchParams.set('order', order)
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: 'Bearer ' + key },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Failed to load ' + name)
  return response.json()
}

function statusClass(status: string) {
  const s = status.toLowerCase()
  if (s.includes('complete')) return 'pill complete'
  if (s.includes('progress') || s.includes('ready') || s.includes('waiting')) return 'pill progress'
  if (s.includes('blocked')) return 'pill blocked'
  return 'pill'
}

export default async function Home() {
  try {
    const [stateRows, tasks, people, timeline, milestones, documents] = await Promise.all([
      table('sale_tracker_state'),
      table('tasks','sort_order.asc'),
      table('people','name.asc'),
      table('timeline_events','event_at.desc'),
      table('milestones','sequence.asc'),
      table('documents','name.asc'),
    ])

    const state = stateRows[0] || {}
    const openTasks = tasks.filter((t:any)=>!['Complete','Done'].includes(t.status)).length
    const blockers = tasks.filter((t:any)=>t.blocker && !['Complete','Done'].includes(t.status)).length
    const waiting = tasks.filter((t:any)=>['Waiting','Blocked'].includes(t.status)).length
    const actionEvents = timeline.filter((e:any)=>e.action_required).length

    return (
      <main className="shell">
        <section className="hero">
          <div>
            <div className="eyebrow">Property sale control centre</div>
            <h1>24 Mason Street</h1>
            <p>{state.property_address}</p>
            <p style={{marginTop:8}}>Current stage: <strong>{state.overall_stage}</strong></p>
          </div>
          <div className="price">
            <span>Accepted offer</span>
            <strong>£{Number(state.sale_price_gbp || 0).toLocaleString('en-GB')}</strong>
            <span>{state.buyer_summary}</span>
          </div>
        </section>

        <section className="stagebar">
          {milestones.map((m:any) => (
            <div key={m.id} className={'stage ' + (m.status==='Complete'?'done':m.status==='In progress'?'current':'')}>
              <b>{m.name}</b>
              <small>{m.status}</small>
            </div>
          ))}
        </section>

        <section className="summary">
          <div className="metric"><div className="n">{openTasks}</div><div className="l">Open items</div></div>
          <div className="metric"><div className="n">{blockers}</div><div className="l">Blockers</div></div>
          <div className="metric"><div className="n">{waiting}</div><div className="l">Waiting on others</div></div>
          <div className="metric"><div className="n">{actionEvents}</div><div className="l">Action events</div></div>
        </section>

        <section className="grid">
          <div>
            <div className="card">
              <h2>Open actions</h2>
              {tasks.map((t:any)=>(
                <div className="task" key={t.id}>
                  <span className={'dot ' + (t.priority==='High'?'high':t.priority==='Low'?'low':'medium')}/>
                  <div>
                    <h3>{t.title}</h3>
                    <p>{t.description}</p>
                    <p style={{marginTop:5}}><strong>Owner:</strong> {t.owner || '—'}{t.waiting_on ? <> · <strong>Waiting on:</strong> {t.waiting_on}</> : null}</p>
                  </div>
                  <span className={statusClass(t.status)}>{t.status}</span>
                </div>
              ))}
            </div>

            <div className="card" style={{marginTop:18}}>
              <h2>Timeline</h2>
              <div className="timeline">
                {timeline.map((e:any)=>(
                  <div className="event" key={e.id}>
                    <time>{new Date(e.event_at).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'})}</time>
                    <h3>{e.title}{e.actor ? ' — ' + e.actor : ''}</h3>
                    <p>{e.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside>
            <div className="card">
              <h2>People</h2>
              <div className="people">
                {people.map((p:any)=>(
                  <div className="person" key={p.id}>
                    <b>{p.name}</b>
                    <small>{p.role || ''}{p.organisation ? ' · ' + p.organisation : ''}</small>
                    {p.notes ? <small>{p.notes}</small> : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="card docs" style={{marginTop:18}}>
              <h2>Documents</h2>
              {documents.map((d:any)=>(
                <div className="row" key={d.id}>
                  <div><strong>{d.name}</strong><div className="muted">{d.holder || '—'}</div></div>
                  <span className={statusClass(d.status)}>{d.status}</span>
                </div>
              ))}
            </div>

            <div className="card" style={{marginTop:18}}>
              <h2>Monitoring</h2>
              <p style={{fontSize:12,lineHeight:1.6,margin:0}}>
                Daily Outlook monitoring is active. New sale-related emails can add or update tasks, milestones, people, documents and timeline events.
              </p>
            </div>
          </aside>
        </section>

        <div className="footer">Live data from the dedicated 24 Mason Street Supabase project</div>
      </main>
    )
  } catch (error:any) {
    return <main className="shell"><div className="error"><strong>Tracker configuration incomplete.</strong><br/>{error.message}</div></main>
  }
}
