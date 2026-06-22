export default function Slide14Team1() {
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
            The Founding Team
          </h2>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          height: "75vh",
          padding: "6vh 10vw",
          gap: "5vw",
        }}
      >
        <div
          style={{
            flex: 1,
            backgroundColor: "#1A1A1A",
            padding: "5vh 3.5vw",
            borderTop: "0.3vh solid #A0785A",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                width: "7vw",
                height: "7vw",
                borderRadius: "50%",
                backgroundColor: "#252525",
                border: "0.15vh solid #A0785A",
                marginBottom: "3vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: "2.5vw", fontWeight: 200, color: "#A0785A" }}>CEO</span>
            </div>
            <div style={{ fontSize: "1.5vw", fontWeight: 500, color: "#FFFFFF", marginBottom: "0.5vh" }}>Founder &amp; CEO</div>
            <div style={{ fontSize: "1vw", color: "#A0785A", marginBottom: "2.5vh" }}>Operations &amp; Industry</div>
            <div style={{ fontSize: "1vw", color: "#888888", lineHeight: 1.6 }}>
              10 years in heavy construction logistics. Previously operations director at a regional excavation firm managing $30M/yr in subcontractor hauling. Built the relationship network that seeds our operator supply.
            </div>
          </div>
          <div style={{ fontSize: "0.9vw", color: "#555555", borderTop: "0.1vh solid #2A2A2A", paddingTop: "2vh" }}>
            Equity — 70% (Founders' Pool)
          </div>
        </div>

        <div
          style={{
            flex: 1,
            backgroundColor: "#1A1A1A",
            padding: "5vh 3.5vw",
            borderTop: "0.3vh solid #333333",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                width: "7vw",
                height: "7vw",
                borderRadius: "50%",
                backgroundColor: "#252525",
                border: "0.15vh solid #555555",
                marginBottom: "3vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: "2.5vw", fontWeight: 200, color: "#888888" }}>CTO</span>
            </div>
            <div style={{ fontSize: "1.5vw", fontWeight: 500, color: "#FFFFFF", marginBottom: "0.5vh" }}>Co-Founder &amp; CTO</div>
            <div style={{ fontSize: "1vw", color: "#888888", marginBottom: "2.5vh" }}>Engineering &amp; Product</div>
            <div style={{ fontSize: "1vw", color: "#888888", lineHeight: 1.6 }}>
              Former senior engineer at a gig-economy logistics startup (acquired 2023). Architected real-time dispatch systems handling 50,000+ daily jobs. Leads all product development and infrastructure decisions.
            </div>
          </div>
          <div style={{ fontSize: "0.9vw", color: "#555555", borderTop: "0.1vh solid #2A2A2A", paddingTop: "2vh" }}>
            Equity partner — 5%
          </div>
        </div>

        <div
          style={{
            flex: 1,
            backgroundColor: "#1A1A1A",
            padding: "5vh 3.5vw",
            borderTop: "0.3vh solid #333333",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                width: "7vw",
                height: "7vw",
                borderRadius: "50%",
                backgroundColor: "#252525",
                border: "0.15vh solid #555555",
                marginBottom: "3vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: "2.5vw", fontWeight: 200, color: "#888888" }}>CFO</span>
            </div>
            <div style={{ fontSize: "1.5vw", fontWeight: 500, color: "#FFFFFF", marginBottom: "0.5vh" }}>Co-Founder &amp; CFO</div>
            <div style={{ fontSize: "1vw", color: "#888888", marginBottom: "2.5vh" }}>Finance &amp; Strategy</div>
            <div style={{ fontSize: "1vw", color: "#888888", lineHeight: 1.6 }}>
              CPA and former investment banking analyst with experience in transportation M&amp;A. Structured two marketplace financing rounds prior to HaulBrokr. Leads financial modeling, investor relations, and compliance.
            </div>
          </div>
          <div style={{ fontSize: "0.9vw", color: "#555555", borderTop: "0.1vh solid #2A2A2A", paddingTop: "2vh" }}>
            Equity partner — 5%
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
        <span style={{ color: "#A0785A" }}>14</span>
      </div>
    </div>
  );
}
