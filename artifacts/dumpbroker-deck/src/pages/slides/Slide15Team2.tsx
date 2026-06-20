export default function Slide15Team2() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#141414",
        fontFamily: "'Inter', sans-serif",
        color: "#FFFFFF",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "15vh",
          left: 0,
          width: "100vw",
          height: "0.1vh",
          backgroundColor: "#A0785A",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "15vh",
          padding: "0 10vw",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5vh" }}>
          <div style={{ fontSize: "0.75vw", fontWeight: 500, color: "#A0785A", textTransform: "uppercase", letterSpacing: "0.25em" }}>
            08 — The Team
          </div>
          <h2 style={{ fontSize: "2.4vw", fontWeight: 300, margin: 0, letterSpacing: "0.02em" }}>
            Advisory Board &amp; Extended Team
          </h2>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          height: "75vh",
          padding: "6vh 10vw",
          gap: "8vw",
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3.5vh" }}>
          <div style={{ fontSize: "1.1vw", fontWeight: 500, color: "#A0785A", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Advisory Board
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "3vh" }}>
            <div style={{ borderBottom: "0.1vh solid #222222", paddingBottom: "2.5vh" }}>
              <div style={{ fontSize: "1.2vw", fontWeight: 500, color: "#FFFFFF", marginBottom: "0.5vh" }}>Industry Adviser</div>
              <div style={{ fontSize: "0.95vw", color: "#A0785A", marginBottom: "1vh" }}>Former VP Operations, major U.S. quarry company</div>
              <div style={{ fontSize: "0.95vw", color: "#888888", lineHeight: 1.5 }}>
                30 years managing bulk material logistics. Guides procurement strategy and introduces our platform to enterprise quarry and mining accounts.
              </div>
            </div>

            <div style={{ borderBottom: "0.1vh solid #222222", paddingBottom: "2.5vh" }}>
              <div style={{ fontSize: "1.2vw", fontWeight: 500, color: "#FFFFFF", marginBottom: "0.5vh" }}>Legal Adviser</div>
              <div style={{ fontSize: "0.95vw", color: "#888888", marginBottom: "1vh" }}>Transportation and marketplace law specialist</div>
              <div style={{ fontSize: "0.95vw", color: "#888888", lineHeight: 1.5 }}>
                Advises on DOT compliance framework, contractor classification, and marketplace terms of service across multi-state expansion.
              </div>
            </div>

            <div>
              <div style={{ fontSize: "1.2vw", fontWeight: 500, color: "#FFFFFF", marginBottom: "0.5vh" }}>Growth Adviser</div>
              <div style={{ fontSize: "0.95vw", color: "#888888", marginBottom: "1vh" }}>Former Head of Growth, gig-economy platform (Series C)</div>
              <div style={{ fontSize: "0.95vw", color: "#888888", lineHeight: 1.5 }}>
                Scaled a two-sided marketplace from 200 to 80,000 service providers in 18 months. Guides our supply-side acquisition and retention playbook.
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            flex: "0 0 30vw",
            borderLeft: "0.1vh solid #333333",
            paddingLeft: "5vw",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "4vh",
          }}
        >
          <div style={{ fontSize: "1.1vw", fontWeight: 500, color: "#A0785A", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Open Partner Roles
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "3vh" }}>
            <div style={{ backgroundColor: "#1A1A1A", padding: "2.5vh 2.5vw", borderLeft: "0.3vh solid #A0785A" }}>
              <div style={{ fontSize: "1.1vw", fontWeight: 500, color: "#FFFFFF", marginBottom: "0.8vh" }}>VP Marketing</div>
              <div style={{ fontSize: "0.95vw", color: "#888888", lineHeight: 1.5 }}>
                5% equity. Leads brand and performance marketing. B2B construction sector experience preferred.
              </div>
            </div>

            <div style={{ backgroundColor: "#1A1A1A", padding: "2.5vh 2.5vw", borderLeft: "0.3vh solid #333333" }}>
              <div style={{ fontSize: "1.1vw", fontWeight: 500, color: "#888888", marginBottom: "0.8vh" }}>Employee Option Pool</div>
              <div style={{ fontSize: "0.95vw", color: "#666666", lineHeight: 1.5 }}>
                5% reserved for engineering hires, account managers, and city launchers. 4-year vesting, 1-year cliff.
              </div>
            </div>

            <div style={{ backgroundColor: "#1A1A1A", padding: "2.5vh 2.5vw", borderLeft: "0.3vh solid #333333" }}>
              <div style={{ fontSize: "1.1vw", fontWeight: 500, color: "#888888", marginBottom: "0.8vh" }}>Board Observer Seat</div>
              <div style={{ fontSize: "0.95vw", color: "#666666", lineHeight: 1.5 }}>
                Available to lead equity partner. Quarterly board meetings. Full financial reporting access.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "4vh",
          left: "10vw",
          right: "10vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.8vw",
          fontWeight: 500,
          color: "#666666",
          textTransform: "uppercase",
          letterSpacing: "0.2em",
        }}
      >
        <span>HaulBrokr&nbsp;&bull;&nbsp;Confidential&nbsp;&bull;&nbsp;2026</span>
        <span style={{ color: "#A0785A" }}>15</span>
      </div>
    </div>
  );
}
