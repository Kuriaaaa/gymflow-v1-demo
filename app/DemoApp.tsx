import { FormEvent, ReactNode, useEffect, useState } from "react";
import { assignedMemberIds, canTrainerManageMember, hasActiveAssignment } from "./demo-policy";
import {
  PAYMENT_METHODS,
  PERSONA_IDS,
  ROLES,
  activateMembership,
  activeMembership,
  addExpense,
  cancelMembership,
  confirmPayment,
  createInitialState,
  dayKey,
  expiringWithin,
  membershipStatus,
  nameOf,
  nextId,
  recordPayment,
  rejectPayment,
  renewMembership,
  requestPayment,
  restoreState,
  toggleAttendance,
  type DemoState,
  type Package,
  type PaymentMethod,
  type Person,
  type Role,
  type RuleResult,
} from "./demo-rules";

const STORAGE_KEY = "gymflow-public-demo";
const DEMO_MAILTO = "mailto:johnkuria6996@gmail.com?subject=GymFlow%20demo%20request";

const roleStory: Record<Role, { number: string; title: string; description: string; scope: string }> = {
  owner: { number: "01", title: "Run the whole operation", description: "Revenue, people, packages and expenses in one decisive view.", scope: "Full oversight" },
  receptionist: { number: "02", title: "Keep the front desk moving", description: "Register members, activate and renew plans, confirm payments and track attendance.", scope: "Operations access" },
  trainer: { number: "03", title: "Coach with context", description: "See assigned members, plan sessions and deliver focused workout programmes.", scope: "Assigned members only" },
  member: { number: "04", title: "Own the fitness journey", description: "Follow membership, sessions, workouts and visits, and request payments privately.", scope: "Personal data only" },
};
const money = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });
const dateTimeFormat = new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" });
const dayFormat = new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeZone: "UTC" });

function formatWhen(value: string | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormat.format(date);
}
function formatDay(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? day : dayFormat.format(date);
}

function loadDemoState(): DemoState {
  if (typeof window === "undefined") return createInitialState();
  try {
    return restoreState(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return createInitialState();
  }
}

export default function DemoApp() {
  const [role, setRole] = useState<Role>("owner");
  const [data, setData] = useState<DemoState>(loadDemoState);
  const [message, setMessage] = useState("Demo ready. Choose a role to explore its workspace.");

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage can be unavailable (private browsing, quota); the demo still works in memory.
    }
  }, [data]);

  // Keep "now" in state (refreshed every minute) so expiry, check-in rules and
  // "Expiring this week" follow the real calendar without impure renders.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const today = dayKey(now);
  const isStaff = role === "owner" || role === "receptionist";
  const activePerson = data.people.find((person) => person.id === PERSONA_IDS[role])!;
  const members = data.people.filter((person) => person.role === "member");
  const trainers = data.people.filter((person) => person.role === "trainer");
  const relatedIds = assignedMemberIds(data.assignments, activePerson.id);
  const assignedMembers = members.filter((person) => relatedIds.has(person.id));

  const canSeeMember = (memberId: number) =>
    isStaff || (role === "member" && memberId === activePerson.id) || (role === "trainer" && relatedIds.has(memberId));

  const visible = (() => {
    if (role === "owner") return data.people;
    if (role === "receptionist") return data.people.filter((person) => person.role === "member" || person.role === "trainer");
    if (role === "trainer") return assignedMembers;
    return [];
  })();

  const memberships = data.memberships.filter((item) => canSeeMember(item.memberId));
  const visits = data.visits.filter((item) => canSeeMember(item.memberId));
  const sessions = data.sessions.filter((item) =>
    isStaff || (role === "member" && item.memberId === activePerson.id) || (role === "trainer" && item.trainerId === activePerson.id),
  );
  const workouts = data.workouts.filter((item) =>
    role === "owner" || (role === "member" && item.memberId === activePerson.id) || (role === "trainer" && item.trainerId === activePerson.id),
  );
  const payments = data.payments.filter((item) => isStaff || (role === "member" && item.memberId === activePerson.id));
  const pendingPayments = data.payments.filter((item) => item.status === "pending");
  const expiring = isStaff ? expiringWithin(data, today, 7) : [];

  const metrics: [string, string | number][] = (() => {
    const activeCount = (ids: number[]) => ids.filter((id) => activeMembership(data, id, today)).length;
    const insideCount = (ids: number[]) => data.visits.filter((item) => !item.checkedOut && ids.includes(item.memberId)).length;
    const memberIds = members.map((item) => item.id);
    if (role === "owner") {
      const revenue = data.payments.filter((item) => item.status === "confirmed").reduce((sum, item) => sum + item.amount, 0);
      return [["Members", members.length], ["Active memberships", activeCount(memberIds)], ["Checked in now", insideCount(memberIds)], ["Confirmed revenue", money.format(revenue)]];
    }
    if (role === "receptionist") {
      return [["Members", members.length], ["Active memberships", activeCount(memberIds)], ["Checked in now", insideCount(memberIds)], ["Payments to confirm", pendingPayments.length]];
    }
    if (role === "trainer") {
      const ids = assignedMembers.map((item) => item.id);
      return [["Assigned members", ids.length], ["Assigned with active plan", activeCount(ids)], ["Assigned checked in", insideCount(ids)], ["My sessions", sessions.length]];
    }
    const own = activeMembership(data, activePerson.id, today);
    const upcomingSessions = sessions.filter((item) => new Date(item.startsAt).getTime() >= now.getTime()).length;
    return [["Membership valid until", own ? formatDay(own.endsOn) : "No active plan"], ["My visits", visits.length], ["Upcoming sessions", upcomingSessions], ["Workout plans", workouts.length]];
  })();

  /**
   * Validates against the rendered state for the message, then applies the same
   * pure rule to the latest state with a functional update.
   */
  function run(rule: (state: DemoState) => RuleResult): boolean {
    const preview = rule(data);
    setMessage(preview.message);
    if (!preview.ok) return false;
    setData((current) => {
      const result = rule(current);
      return result.ok ? result.state : current;
    });
    return true;
  }

  function value(form: HTMLFormElement, name: string) {
    return String(new FormData(form).get(name) ?? "").trim();
  }

  function chooseRole(next: Role, scroll = false) {
    setRole(next);
    setMessage(`${next} workspace loaded.`);
    if (scroll) document.querySelector("#workspace")?.scrollIntoView({ behavior: "smooth" });
  }

  function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = value(form, "name");
    const email = value(form, "email").toLowerCase();
    const ok = run((state) => {
      if (!name || !email) return { ok: false, message: "Name and email are required." };
      if (state.people.some((person) => person.email === email)) return { ok: false, message: "That email is already registered." };
      return {
        ok: true,
        state: { ...state, people: [...state.people, { id: nextId(state.people), name, email, role: "member", status: "active" }] },
        message: `Fictional member ${name} registered. This public demo does not create or store passwords.`,
      };
    });
    if (ok) form.reset();
  }

  function assignTrainer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const memberId = Number(value(form, "memberId"));
    const trainerId = Number(value(form, "trainerId"));
    run((state) => {
      if (hasActiveAssignment(state.assignments, trainerId, memberId)) return { ok: false, message: "That trainer is already assigned to this member." };
      return {
        ok: true,
        state: { ...state, assignments: [...state.assignments, { id: nextId(state.assignments), memberId, trainerId, active: true }] },
        message: `${nameOf(state, trainerId)} assigned to ${nameOf(state, memberId)}.`,
      };
    });
  }

  function addMembership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const memberId = Number(value(form, "memberId"));
    const packageName = value(form, "packageName");
    run((state) => activateMembership(state, memberId, packageName, today));
  }

  function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const packageName = value(form, "packageName");
    const method = value(form, "method") as PaymentMethod;
    const nowIso = new Date().toISOString();
    if (role === "member") {
      run((state) => requestPayment(state, activePerson.id, packageName, method, today, nowIso));
    } else {
      const memberId = Number(value(form, "memberId"));
      run((state) => recordPayment(state, role, memberId, packageName, method, today, nowIso));
    }
  }

  function attendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const memberId = Number(value(event.currentTarget, "memberId"));
    const nowIso = new Date().toISOString();
    run((state) => toggleAttendance(state, memberId, today, nowIso));
  }

  function addSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const trainerId = role === "trainer" ? activePerson.id : Number(value(form, "trainerId"));
    const memberId = Number(value(form, "memberId"));
    const title = value(form, "title");
    const startsAt = value(form, "startsAt");
    const ok = run((state) => {
      if (role === "trainer" && !canTrainerManageMember(state.assignments, trainerId, memberId)) return { ok: false, message: "Blocked: trainers can schedule assigned members only." };
      if (!title || Number.isNaN(new Date(startsAt).getTime())) return { ok: false, message: "Session title and a valid start time are required." };
      return {
        ok: true,
        state: { ...state, sessions: [...state.sessions, { id: nextId(state.sessions), memberId, trainerId, title, startsAt }] },
        message: "Training session scheduled.",
      };
    });
    if (ok) form.reset();
  }

  function addWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const trainerId = role === "trainer" ? activePerson.id : Number(value(form, "trainerId"));
    const memberId = Number(value(form, "memberId"));
    const title = value(form, "title");
    const instructions = value(form, "instructions");
    const ok = run((state) => {
      if (role === "trainer" && !canTrainerManageMember(state.assignments, trainerId, memberId)) return { ok: false, message: "Blocked: trainers can assign workouts to assigned members only." };
      if (!title || !instructions) return { ok: false, message: "Plan title and instructions are required." };
      return {
        ok: true,
        state: { ...state, workouts: [...state.workouts, { id: nextId(state.workouts), memberId, trainerId, title, instructions }] },
        message: "Workout plan assigned.",
      };
    });
    if (ok) form.reset();
  }

  function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const category = value(form, "category");
    const amount = Number(value(form, "amount"));
    if (run((state) => addExpense(state, category, amount, today))) form.reset();
  }

  function resetDemo() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore unavailable storage
    }
    setData(createInitialState());
    setMessage("Demo data reset.");
  }

  const membershipRows = memberships.map((item) => {
    const status = membershipStatus(item, today);
    const actions = isStaff && status !== "cancelled" ? (
      <span className="row-actions">
        <button type="button" className="mini" onClick={() => run((state) => renewMembership(state, item.id, today))}>Renew</button>
        {(status === "active" || status === "upcoming") && <button type="button" className="mini danger" onClick={() => run((state) => cancelMembership(state, item.id, today))}>Cancel</button>}
      </span>
    ) : null;
    const row: ReactNode[] = [nameOf(data, item.memberId), item.packageName, `${formatDay(item.startsOn)} – ${formatDay(item.endsOn)}`, <span key="s" className={`pill ${status}`}>{status}</span>];
    if (isStaff) row.push(actions ?? "—");
    return row;
  });

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top"><b>GF</b> GYMFLOW <span>V1</span></a>
        <nav aria-label="Demo navigation"><a href="#personas">Personas</a><a href="#workspace">Live demo</a><a href="#security">Security</a><a href="#book-demo">Book a demo</a></nav>
        <div className="demo-badge">PUBLIC DEMO · FICTIONAL DATA</div>
        <div className="topbar-actions">
          <a className="cta-link" href={DEMO_MAILTO}>Book a demo</a>
          <button className="ghost" onClick={resetDemo}>Reset demo</button>
        </div>
      </header>

      <section id="top" className="hero" style={{ backgroundImage: "url('images/gymflow-demo-hero-v2.jpg')" }}>
        <div className="hero-copy">
          <p className="eyebrow">GYMFLOW · GYM MANAGEMENT FOR EAST AFRICA</p>
          <h1>The gym,<br/><span>in perfect flow.</span></h1>
          <p className="lead">Experience how one connected platform moves a member from welcome desk to workout, payment and measurable progress—without crossing a single privacy boundary.</p>
          <div className="hero-actions">
            <a className="primary-link" href="#workspace">Explore the demo</a>
            <a className="secondary-link" href={DEMO_MAILTO}>Book a demo</a>
            <span className="demo-note">No account setup required · Fictional browser-only data</span>
          </div>
        </div>
        <div className="role-switcher" aria-label="Choose demo role">
          <p>Step into a workspace</p>
          {ROLES.map((item) => (
            <button key={item} className={role === item ? "active" : ""} onClick={() => chooseRole(item, true)}><span>{roleStory[item].number}</span>{item}<small>{roleStory[item].scope}</small></button>
          ))}
        </div>
        <div className="hero-proof"><span>4 role-based views</span><span>1 shared operation</span><span>100% fictional data</span></div>
      </section>

      <section id="personas" className="persona-section">
        <div className="section-intro"><p className="eyebrow">THE PEOPLE INSIDE THE FLOW</p><h2>Different jobs.<br/>One source of truth.</h2><p>Choose a role to preview its purpose, then enter the workspace to try real demo actions.</p></div>
        <div className="persona-grid">
          {ROLES.map((item) => <button key={item} className={`persona-card ${role === item ? "selected" : ""}`} onClick={() => chooseRole(item)}><span>{roleStory[item].number}</span><h3>{item}</h3><strong>{roleStory[item].title}</strong><p>{roleStory[item].description}</p><small>{roleStory[item].scope} →</small></button>)}
        </div>
      </section>

      <section className="story-panel" style={{ backgroundImage: "url('images/gymflow-demo-operations-v2.jpg')" }}>
        <div><p className="eyebrow">A COMPLETE DAY, CONNECTED</p><h2>From first hello<br/>to the final set.</h2><ol><li><b>01</b><span><strong>Reception</strong>Member joins, selects a plan and checks in.</span></li><li><b>02</b><span><strong>Coaching</strong>Trainer receives the assignment and builds the session.</span></li><li><b>03</b><span><strong>Insight</strong>Owner sees the operational outcome—not private noise.</span></li></ol></div>
      </section>

      <section id="workspace" className={`workspace role-${role}`}>
        <div className="workspace-head">
          <div><p className="eyebrow">INTERACTIVE {role} WORKSPACE</p><h2>Hello, {activePerson.name}.</h2><p>{roleStory[role].description}</p></div>
          <div className="status">Browser-only demo · changes are saved on this device only</div>
        </div>
        <div className="workspace-role-tabs">{ROLES.map((item) => <button key={item} className={role === item ? "active" : ""} onClick={() => chooseRole(item)}>{item}</button>)}</div>
        <div className="metrics">
          {metrics.map(([label, metric]) => <Metric key={label} label={label} value={metric}/>)}
        </div>
        <div className="notice" role="status" aria-live="polite">{message}</div>

        {isStaff && (
          <div className="attention-grid">
            <article className="table-card">
              <h4>Payments awaiting confirmation</h4>
              {pendingPayments.length === 0 ? <p className="empty-note">Nothing to confirm right now.</p> : (
                <ul className="attention-list">
                  {pendingPayments.map((item) => (
                    <li key={item.id}>
                      <span><strong>{nameOf(data, item.memberId)}</strong>{item.packageName} · {money.format(item.amount)} · {item.method}<small>{item.reference} · requested {formatWhen(item.createdAt)}</small></span>
                      <span className="row-actions">
                        <button type="button" className="mini" onClick={() => run((state) => confirmPayment(state, role, item.id, today))}>Confirm</button>
                        <button type="button" className="mini danger" onClick={() => run((state) => rejectPayment(state, role, item.id))}>Reject</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
            <article className="table-card">
              <h4>Expiring this week</h4>
              {expiring.length === 0 ? <p className="empty-note">No memberships end in the next 7 days.</p> : (
                <ul className="attention-list">
                  {expiring.map((item) => {
                    const daysLeft = Math.round((Date.parse(`${item.endsOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
                    return (
                      <li key={item.id}>
                        <span><strong>{nameOf(data, item.memberId)}</strong>{item.packageName} · ends {formatDay(item.endsOn)}<small>{daysLeft === 0 ? "Last day today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}</small></span>
                        <span className="row-actions"><button type="button" className="mini" onClick={() => run((state) => renewMembership(state, item.id, today))}>Renew</button></span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          </div>
        )}

        <h3 className="section-title">Quick actions</h3>
        <div className="action-grid">
          {isStaff && <Action title="Register fictional member" onSubmit={addMember}><Input name="name" label="Full name"/><Input name="email" label="Email" type="email"/><Submit>Register member</Submit></Action>}
          {isStaff && <Action title="Assign trainer" onSubmit={assignTrainer}><Select name="memberId" label="Member" items={members}/><Select name="trainerId" label="Trainer" items={trainers}/><Submit>Assign trainer</Submit></Action>}
          {isStaff && <Action title="Activate membership" onSubmit={addMembership}><Select name="memberId" label="Member" items={members}/><PackageSelect packages={data.packages}/><Submit>Activate</Submit></Action>}
          {isStaff && <Action title="Record desk payment" onSubmit={submitPayment}><Select name="memberId" label="Member" items={members}/><PackageSelect packages={data.packages}/><PaymentMethodSelect/><p className="hint">Settles the membership awaiting payment, or starts the next period.</p><Submit>Record payment</Submit></Action>}
          {role === "member" && <Action title="Request payment" onSubmit={submitPayment}><PackageSelect packages={data.packages}/><PaymentMethodSelect/><p className="hint">Requests stay pending until the front desk confirms them.</p><Submit>Request payment</Submit></Action>}
          {isStaff && <Action title="Attendance desk" onSubmit={attendance}><Select name="memberId" label="Member" items={members}/><p className="hint">Check-in requires an active membership.</p><Submit>Toggle check-in/out</Submit></Action>}
          {(isStaff || role === "trainer") && <Action title="Schedule session" onSubmit={addSchedule}><Select name="memberId" label="Member" items={role === "trainer" ? assignedMembers : members}/>{role !== "trainer" && <Select name="trainerId" label="Trainer" items={trainers}/>}<Input name="title" label="Session title"/><Input name="startsAt" label="Starts" type="datetime-local"/><Submit>Schedule</Submit></Action>}
          {(role === "owner" || role === "trainer") && <Action title="Assign workout" onSubmit={addWorkout}><Select name="memberId" label="Member" items={role === "trainer" ? assignedMembers : members}/>{role !== "trainer" && <Select name="trainerId" label="Trainer" items={trainers}/>}<Input name="title" label="Plan title"/><Input name="instructions" label="Instructions"/><Submit>Assign plan</Submit></Action>}
          {role === "owner" && <Action title="Record expense" onSubmit={submitExpense}><Input name="category" label="Category"/><label>Amount (KES)<input name="amount" type="number" min="1" step="1" required/></label><Submit>Record expense</Submit></Action>}
          {role === "member" && <div className="action-card profile-card"><h4>Member self-service</h4><p>View membership, attendance, sessions, workouts and payments below. Profile and progress records stay private to this browser demo.</p></div>}
        </div>

        <h3 className="section-title">Live records</h3>
        <div className="record-grid">
          {visible.length > 0 && <Table title="People" heads={["Name", "Role", "Email"]} rows={visible.map((item) => [item.name, item.role, item.email])}/>}
          <Table title="Memberships" heads={isStaff ? ["Member", "Package", "Period", "Status", "Actions"] : ["Member", "Package", "Period", "Status"]} rows={membershipRows}/>
          <Table title="Attendance" heads={["Member", "Check in", "Check out"]} rows={visits.map((item) => [nameOf(data, item.memberId), formatWhen(item.checkedIn), item.checkedOut ? formatWhen(item.checkedOut) : "Inside"])}/>
          <Table title="Schedule" heads={["Session", "Member", "Trainer", "Starts"]} rows={sessions.map((item) => [item.title, nameOf(data, item.memberId), nameOf(data, item.trainerId), formatWhen(item.startsAt)])}/>
          {role !== "receptionist" && <Table title="Workout plans" heads={["Plan", "Member", "Instructions"]} rows={workouts.map((item) => [item.title, nameOf(data, item.memberId), item.instructions])}/>}
          {role !== "trainer" && <Table title="Payments" heads={["Reference", "Member", "Package", "Method", "Amount", "Status"]} rows={payments.map((item) => [item.reference, nameOf(data, item.memberId), item.packageName, item.method, money.format(item.amount), <span key="s" className={`pill ${item.status}`}>{item.status}</span>])}/>}
          {role === "owner" && <Table title="Expenses" heads={["Date", "Category", "Amount"]} rows={data.expenses.map((item) => [formatDay(item.date), item.category, money.format(item.amount)])}/>}
        </div>
      </section>
      <section id="security" className="security-section"><div><p className="eyebrow">PRIVACY BY ROLE</p><h2>Shared operations.<br/>Separated views.</h2><p>This browser-only showcase uses fictional data and an open role switcher. It demonstrates access boundaries; secure authentication and server-enforced authorization run in the live application.</p></div><div className="security-grid"><article><b>Owner</b><p>Sees business-wide operational records and administration.</p></article><article><b>Reception</b><p>Handles members and confirms payments without private workout details.</p></article><article><b>Trainer</b><p>Sees assigned members only—never gym finances.</p></article><article><b>Member</b><p>Sees only their own membership and fitness journey, and requests payments for the desk to confirm.</p></article></div></section>
      <section id="book-demo" className="cta-section">
        <div>
          <p className="eyebrow">BRING GYMFLOW TO YOUR GYM</p>
          <h2>See it with your own members, plans and front desk.</h2>
          <p>Book a walkthrough and we will show how GymFlow handles memberships, M-Pesa payments, attendance and coaching for your gym.</p>
        </div>
        <a className="primary-link" href={DEMO_MAILTO}>Book a demo</a>
      </section>
      <footer><strong>GymFlow V1</strong><span>Public demonstration · No real payments or personal data · <a href={DEMO_MAILTO}>Book a demo</a></span></footer>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) { return <article className="metric"><span>{label}</span><strong>{value}</strong></article>; }
function Action({ title, onSubmit, children }: { title: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; children: ReactNode }) { return <form className="action-card" onSubmit={onSubmit}><h4>{title}</h4>{children}</form>; }
function Input({ name, label, type = "text" }: { name: string; label: string; type?: string }) { return <label>{label}<input name={name} type={type} required/></label>; }
function Select({ name, label, items }: { name: string; label: string; items: Person[] }) { return <label>{label}<select name={name} required>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>; }
function PackageSelect({ packages }: { packages: Package[] }) { return <label>Package<select name="packageName" required>{packages.map((item) => <option key={item.name} value={item.name}>{item.name} · {money.format(item.price)}</option>)}</select></label>; }
function PaymentMethodSelect() { return <label>Payment method<select name="method" required>{PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}</select></label>; }
function Submit({ children }: { children: ReactNode }) { return <button className="primary" type="submit">{children}</button>; }
function Table({ title, heads, rows }: { title: string; heads: string[]; rows: ReactNode[][] }) {
  return <article className="table-card"><h4>{title}</h4><div className="table-wrap"><table><thead><tr>{heads.map((head) => <th key={head}>{head}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={heads.length} className="empty">No records in this view</td></tr>}</tbody></table></div></article>;
}
