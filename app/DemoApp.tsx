"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Role = "owner" | "receptionist" | "trainer" | "member";
type Person = { id: number; name: string; email: string; role: Role; status: "active" };
type Membership = { id: number; memberId: number; packageName: string; endsOn: string; status: "active" | "cancelled" };
type Visit = { id: number; memberId: number; checkedIn: string; checkedOut?: string };
type Session = { id: number; memberId: number; trainerId: number; title: string; startsAt: string };
type Workout = { id: number; memberId: number; trainerId: number; title: string; instructions: string };
type Payment = { id: number; memberId: number; packageName: string; amount: number; reference: string };
type Expense = { id: number; category: string; amount: number; date: string };
type Package = { name: string; days: number; price: number };

type DemoState = {
  people: Person[];
  memberships: Membership[];
  visits: Visit[];
  sessions: Session[];
  workouts: Workout[];
  payments: Payment[];
  expenses: Expense[];
  packages: Package[];
};

const initial: DemoState = {
  people: [
    { id: 1, name: "Amina Kamau", email: "owner@demo.gymflow", role: "owner", status: "active" },
    { id: 2, name: "Lydia Wanjiku", email: "desk@demo.gymflow", role: "receptionist", status: "active" },
    { id: 3, name: "Brian Otieno", email: "trainer@demo.gymflow", role: "trainer", status: "active" },
    { id: 4, name: "Nia Maina", email: "member@demo.gymflow", role: "member", status: "active" },
    { id: 5, name: "James Kibet", email: "james@demo.gymflow", role: "member", status: "active" },
  ],
  packages: [
    { name: "Daily", days: 1, price: 500 },
    { name: "Monthly", days: 30, price: 3800 },
    { name: "Yearly", days: 365, price: 55000 },
  ],
  memberships: [{ id: 1, memberId: 4, packageName: "Monthly", endsOn: "2026-08-30", status: "active" }],
  visits: [{ id: 1, memberId: 4, checkedIn: "2026-07-31 07:42" }],
  sessions: [{ id: 1, memberId: 4, trainerId: 3, title: "Strength foundation", startsAt: "2026-08-01 09:00" }],
  workouts: [{ id: 1, memberId: 4, trainerId: 3, title: "Full body A", instructions: "3 rounds: squat, press, row and core." }],
  payments: [{ id: 1, memberId: 4, packageName: "Monthly", amount: 3800, reference: "GF-DEMO-001" }],
  expenses: [{ id: 1, category: "Equipment", amount: 8500, date: "2026-07-30" }],
};

const rolePerson: Record<Role, number> = { owner: 1, receptionist: 2, trainer: 3, member: 4 };
const roleStory: Record<Role, { number: string; title: string; description: string; scope: string }> = {
  owner: { number: "01", title: "Run the whole operation", description: "Revenue, people, packages and expenses in one decisive view.", scope: "Full oversight" },
  receptionist: { number: "02", title: "Keep the front desk moving", description: "Register members, activate plans, receive payments and track attendance.", scope: "Operations access" },
  trainer: { number: "03", title: "Coach with context", description: "See assigned members, plan sessions and deliver focused workout programmes.", scope: "Assigned members only" },
  member: { number: "04", title: "Own the fitness journey", description: "Follow membership, sessions, workouts, visits and payments privately.", scope: "Personal data only" },
};
const money = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

function loadDemoState(): DemoState {
  if (typeof window === "undefined") return initial;

  const saved = window.localStorage.getItem("gymflow-public-demo");
  if (!saved) return initial;

  try {
    return JSON.parse(saved) as DemoState;
  } catch {
    return initial;
  }
}

export default function DemoApp() {
  const [role, setRole] = useState<Role>("owner");
  const [data, setData] = useState<DemoState>(loadDemoState);
  const [message, setMessage] = useState("Demo ready. Choose a role to explore its workspace.");

  useEffect(() => {
    window.localStorage.setItem("gymflow-public-demo", JSON.stringify(data));
  }, [data]);

  const activePerson = data.people.find((person) => person.id === rolePerson[role])!;
  const members = data.people.filter((person) => person.role === "member");
  const trainers = data.people.filter((person) => person.role === "trainer");
  const relatedIds = new Set([
    ...data.sessions.filter((item) => item.trainerId === activePerson.id).map((item) => item.memberId),
    ...data.workouts.filter((item) => item.trainerId === activePerson.id).map((item) => item.memberId),
  ]);

  const visible = useMemo(() => {
    if (role === "owner") return data.people;
    if (role === "receptionist") return data.people.filter((person) => ["member", "trainer"].includes(person.role));
    if (role === "trainer") return members;
    return [];
  }, [data.people, members, role]);

  const memberships = data.memberships.filter((item) =>
    role === "owner" || role === "receptionist" ||
    (role === "member" && item.memberId === activePerson.id) ||
    (role === "trainer" && relatedIds.has(item.memberId))
  );
  const visits = data.visits.filter((item) =>
    role === "owner" || role === "receptionist" ||
    (role === "member" && item.memberId === activePerson.id) ||
    (role === "trainer" && relatedIds.has(item.memberId))
  );
  const sessions = data.sessions.filter((item) =>
    role === "owner" || role === "receptionist" ||
    (role === "member" && item.memberId === activePerson.id) ||
    (role === "trainer" && item.trainerId === activePerson.id)
  );
  const workouts = data.workouts.filter((item) =>
    role === "owner" ||
    (role === "member" && item.memberId === activePerson.id) ||
    (role === "trainer" && item.trainerId === activePerson.id)
  );
  const payments = data.payments.filter((item) =>
    role === "owner" || role === "receptionist" ||
    (role === "member" && item.memberId === activePerson.id)
  );

  function value(form: HTMLFormElement, name: string) {
    return String(new FormData(form).get(name) ?? "").trim();
  }

  function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = value(form, "name");
    const email = value(form, "email").toLowerCase();
    if (!name || !email) return setMessage("Name and email are required.");
    if (data.people.some((person) => person.email === email)) return setMessage("That email is already registered.");
    setData((current) => ({ ...current, people: [...current.people, { id: Date.now(), name, email, role: "member", status: "active" }] }));
    form.reset();
    setMessage(`Member ${name} registered with a temporary demo credential.`);
  }

  function addMembership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const memberId = Number(value(form, "memberId"));
    const packageName = value(form, "packageName");
    if (data.memberships.some((item) => item.memberId === memberId && item.status === "active")) {
      return setMessage("Blocked: this member already has one active membership.");
    }
    const selected = data.packages.find((item) => item.name === packageName)!;
    const end = new Date();
    end.setDate(end.getDate() + selected.days);
    setData((current) => ({ ...current, memberships: [...current.memberships, { id: Date.now(), memberId, packageName, endsOn: end.toISOString().slice(0, 10), status: "active" }] }));
    setMessage(`${packageName} membership activated. A second active membership will be rejected.`);
  }

  function approvePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const memberId = role === "member" ? activePerson.id : Number(value(form, "memberId"));
    const packageName = value(form, "packageName");
    const membership = data.memberships.find((item) => item.memberId === memberId && item.status === "active");
    if (membership && membership.packageName !== packageName) return setMessage("Blocked: the selected package differs from the active membership.");
    if (data.payments.some((item) => item.memberId === memberId && membership && item.packageName === membership.packageName)) {
      return setMessage("Blocked: this active membership is already paid.");
    }
    const selected = data.packages.find((item) => item.name === packageName)!;
    let next = data;
    if (!membership) {
      const end = new Date();
      end.setDate(end.getDate() + selected.days);
      next = { ...next, memberships: [...next.memberships, { id: Date.now(), memberId, packageName, endsOn: end.toISOString().slice(0, 10), status: "active" }] };
    }
    setData({ ...next, payments: [...next.payments, { id: Date.now(), memberId, packageName, amount: selected.price, reference: `GF-DEMO-${String(next.payments.length + 1).padStart(3, "0")}` }] });
    setMessage(`${money.format(selected.price)} sandbox payment approved without creating a second membership.`);
  }

  function attendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const memberId = Number(value(form, "memberId"));
    const open = data.visits.find((item) => item.memberId === memberId && !item.checkedOut);
    if (open) {
      setData((current) => ({ ...current, visits: current.visits.map((item) => item.id === open.id ? { ...item, checkedOut: "Now" } : item) }));
      setMessage("Member checked out.");
    } else {
      setData((current) => ({ ...current, visits: [...current.visits, { id: Date.now(), memberId, checkedIn: "Now" }] }));
      setMessage("Member checked in.");
    }
  }

  function addSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const trainerId = role === "trainer" ? activePerson.id : Number(value(form, "trainerId"));
    setData((current) => ({ ...current, sessions: [...current.sessions, { id: Date.now(), memberId: Number(value(form, "memberId")), trainerId, title: value(form, "title"), startsAt: value(form, "startsAt") }] }));
    form.reset();
    setMessage("Training session scheduled.");
  }

  function addWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const trainerId = role === "trainer" ? activePerson.id : Number(value(form, "trainerId"));
    setData((current) => ({ ...current, workouts: [...current.workouts, { id: Date.now(), memberId: Number(value(form, "memberId")), trainerId, title: value(form, "title"), instructions: value(form, "instructions") }] }));
    form.reset();
    setMessage("Workout plan assigned.");
  }

  function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setData((current) => ({ ...current, expenses: [...current.expenses, { id: Date.now(), category: value(form, "category"), amount: Number(value(form, "amount")), date: new Date().toISOString().slice(0, 10) }] }));
    form.reset();
    setMessage("Expense recorded.");
  }

  function resetDemo() {
    setData(initial);
    window.localStorage.removeItem("gymflow-public-demo");
    setMessage("Demo data reset.");
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top"><b>GF</b> GYMFLOW <span>V1</span></a>
        <nav aria-label="Demo navigation"><a href="#personas">Personas</a><a href="#workspace">Live demo</a><a href="#security">Security</a></nav>
        <div className="demo-badge">PUBLIC DEMO · FICTIONAL DATA</div>
        <button className="ghost" onClick={resetDemo}>Reset demo</button>
      </header>

      <section id="top" className="hero" style={{ backgroundImage: "url('images/gymflow-demo-hero-v2.png')" }}>
        <div className="hero-copy">
          <p className="eyebrow">KURIA&apos;S GYM PROJECT · INTERACTIVE EXPERIENCE</p>
          <h1>The gym,<br/><span>in perfect flow.</span></h1>
          <p className="lead">Experience how one connected platform moves a member from welcome desk to workout, payment and measurable progress—without crossing a single privacy boundary.</p>
          <div className="hero-actions"><a className="primary-link" href="#workspace">Explore the demo</a><a className="text-link" href="https://gymflow-v1-app.onrender.com/" target="_blank" rel="noreferrer">Open live application ↗</a></div>
        </div>
        <div className="role-switcher" aria-label="Choose demo role">
          <p>Step into a workspace</p>
          {(["owner", "receptionist", "trainer", "member"] as Role[]).map((item) => (
            <button key={item} className={role === item ? "active" : ""} onClick={() => { setRole(item); setMessage(`${item} workspace loaded.`); document.querySelector("#workspace")?.scrollIntoView({ behavior: "smooth" }); }}><span>{roleStory[item].number}</span>{item}<small>{roleStory[item].scope}</small></button>
          ))}
        </div>
        <div className="hero-proof"><span>4 secured roles</span><span>1 shared operation</span><span>100% fictional data</span></div>
      </section>

      <section id="personas" className="persona-section">
        <div className="section-intro"><p className="eyebrow">THE PEOPLE INSIDE THE FLOW</p><h2>Different jobs.<br/>One source of truth.</h2><p>Choose a role to preview its purpose, then enter the workspace to try real demo actions.</p></div>
        <div className="persona-grid">
          {(["owner", "receptionist", "trainer", "member"] as Role[]).map((item) => <button key={item} className={`persona-card ${role === item ? "selected" : ""}`} onClick={() => { setRole(item); setMessage(`${item} workspace loaded.`); }}><span>{roleStory[item].number}</span><h3>{item}</h3><strong>{roleStory[item].title}</strong><p>{roleStory[item].description}</p><small>{roleStory[item].scope} →</small></button>)}
        </div>
      </section>

      <section className="story-panel" style={{ backgroundImage: "url('images/gymflow-demo-operations-v2.png')" }}>
        <div><p className="eyebrow">A COMPLETE DAY, CONNECTED</p><h2>From first hello<br/>to the final set.</h2><ol><li><b>01</b><span><strong>Reception</strong>Member joins, selects a plan and checks in.</span></li><li><b>02</b><span><strong>Coaching</strong>Trainer receives the assignment and builds the session.</span></li><li><b>03</b><span><strong>Insight</strong>Owner sees the operational outcome—not private noise.</span></li></ol></div>
      </section>

      <section id="workspace" className={`workspace role-${role}`}>
        <div className="workspace-head">
          <div><p className="eyebrow">INTERACTIVE {role} WORKSPACE</p><h2>Hello, {activePerson.name}.</h2><p>{roleStory[role].description}</p></div>
          <div className="status"><i/> All demo services operational</div>
        </div>
        <div className="workspace-role-tabs">{(["owner", "receptionist", "trainer", "member"] as Role[]).map((item) => <button key={item} className={role === item ? "active" : ""} onClick={() => { setRole(item); setMessage(`${item} workspace loaded.`); }}>{item}</button>)}</div>
        <div className="metrics">
          <Metric label="Members" value={members.length}/>
          <Metric label="Active memberships" value={data.memberships.filter((item) => item.status === "active").length}/>
          <Metric label="Checked in" value={data.visits.filter((item) => !item.checkedOut).length}/>
          <Metric label={role === "owner" ? "Revenue" : "Sessions"} value={role === "owner" ? money.format(data.payments.reduce((sum, item) => sum + item.amount, 0)) : sessions.length}/>
        </div>
        <div className="notice">{message}</div>

        <h3 className="section-title">Quick actions</h3>
        <div className="action-grid">
          {(role === "owner" || role === "receptionist") && <Action title="Register member" onSubmit={addMember}><Input name="name" label="Full name"/><Input name="email" label="Email" type="email"/><Input name="password" label="Temporary password" type="password"/><Submit>Register member</Submit></Action>}
          {(role === "owner" || role === "receptionist") && <Action title="Activate membership" onSubmit={addMembership}><Select name="memberId" label="Member" items={members}/><PackageSelect packages={data.packages}/><Submit>Activate</Submit></Action>}
          {(role === "owner" || role === "receptionist" || role === "member") && <Action title="Approve sandbox payment" onSubmit={approvePayment}>{role !== "member" && <Select name="memberId" label="Member" items={members}/>}<PackageSelect packages={data.packages}/><Submit>Approve payment</Submit></Action>}
          {(role === "owner" || role === "receptionist") && <Action title="Attendance desk" onSubmit={attendance}><Select name="memberId" label="Member" items={members}/><Submit>Toggle check-in/out</Submit></Action>}
          {(role === "owner" || role === "receptionist" || role === "trainer") && <Action title="Schedule session" onSubmit={addSchedule}><Select name="memberId" label="Member" items={members}/>{role !== "trainer" && <Select name="trainerId" label="Trainer" items={trainers}/>}<Input name="title" label="Session title"/><Input name="startsAt" label="Starts" type="datetime-local"/><Submit>Schedule</Submit></Action>}
          {(role === "owner" || role === "trainer") && <Action title="Assign workout" onSubmit={addWorkout}><Select name="memberId" label="Member" items={members}/>{role !== "trainer" && <Select name="trainerId" label="Trainer" items={trainers}/>}<Input name="title" label="Plan title"/><Input name="instructions" label="Instructions"/><Submit>Assign plan</Submit></Action>}
          {role === "owner" && <Action title="Record expense" onSubmit={addExpense}><Input name="category" label="Category"/><Input name="amount" label="Amount" type="number"/><Submit>Record expense</Submit></Action>}
          {role === "member" && <div className="action-card profile-card"><h4>Member self-service</h4><p>View membership, attendance, sessions, workouts and payments below. Profile and progress records stay private to this browser demo.</p></div>}
        </div>

        <h3 className="section-title">Live records</h3>
        <div className="record-grid">
          {visible.length > 0 && <Table title="People" heads={["Name", "Role", "Email"]} rows={visible.map((item) => [item.name, item.role, item.email])}/>}
          <Table title="Memberships" heads={["Member", "Package", "Ends"]} rows={memberships.map((item) => [nameOf(item.memberId, data), item.packageName, item.endsOn])}/>
          <Table title="Attendance" heads={["Member", "Check in", "Check out"]} rows={visits.map((item) => [nameOf(item.memberId, data), item.checkedIn, item.checkedOut ?? "Inside"])}/>
          <Table title="Schedule" heads={["Session", "Member", "Trainer"]} rows={sessions.map((item) => [item.title, nameOf(item.memberId, data), nameOf(item.trainerId, data)])}/>
          {role !== "receptionist" && <Table title="Workout plans" heads={["Plan", "Member", "Instructions"]} rows={workouts.map((item) => [item.title, nameOf(item.memberId, data), item.instructions])}/>}
          {role !== "trainer" && <Table title="Payments" heads={["Reference", "Member", "Amount"]} rows={payments.map((item) => [item.reference, nameOf(item.memberId, data), money.format(item.amount)])}/>}
          {role === "owner" && <Table title="Expenses" heads={["Date", "Category", "Amount"]} rows={data.expenses.map((item) => [item.date, item.category, money.format(item.amount)])}/>}
        </div>
      </section>
      <section id="security" className="security-section"><div><p className="eyebrow">PRIVACY BY ROLE</p><h2>Shared operations.<br/>Separated access.</h2></div><div className="security-grid"><article><b>Owner</b><p>Sees business-wide operational records and administration.</p></article><article><b>Reception</b><p>Handles members and payments without private workout details.</p></article><article><b>Trainer</b><p>Sees assigned members only—never gym finances.</p></article><article><b>Member</b><p>Sees only their own membership and fitness journey.</p></article></div></section>
      <footer><strong>GymFlow V1</strong><span>Public demonstration · No real payments or personal data</span></footer>
    </main>
  );
}

function nameOf(id: number, data: DemoState) { return data.people.find((person) => person.id === id)?.name ?? "Unknown"; }
function Metric({ label, value }: { label: string; value: string | number }) { return <article className="metric"><span>{label}</span><strong>{value}</strong></article>; }
function Action({ title, onSubmit, children }: { title: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; children: React.ReactNode }) { return <form className="action-card" onSubmit={onSubmit}><h4>{title}</h4>{children}</form>; }
function Input({ name, label, type = "text" }: { name: string; label: string; type?: string }) { return <label>{label}<input name={name} type={type} required/></label>; }
function Select({ name, label, items }: { name: string; label: string; items: Person[] }) { return <label>{label}<select name={name} required>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>; }
function PackageSelect({ packages }: { packages: Package[] }) { return <label>Package<select name="packageName" required>{packages.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>; }
function Submit({ children }: { children: React.ReactNode }) { return <button className="primary" type="submit">{children}</button>; }
function Table({ title, heads, rows }: { title: string; heads: string[]; rows: (string | number)[][] }) {
  return <article className="table-card"><h4>{title}</h4><div className="table-wrap"><table><thead><tr>{heads.map((head) => <th key={head}>{head}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={heads.length} className="empty">No records in this view</td></tr>}</tbody></table></div></article>;
}
