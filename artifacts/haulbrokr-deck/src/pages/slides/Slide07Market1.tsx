export default function Slide07Market1() {
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
          <div
            style={{
              fontSize: "0.75vw",
              fontWeight: 500,
              color: "#A0785A",
              textTransform: "uppercase",
              letterSpacing: "0.25em",
            }}
          >
            04 — Market Opportunity
          </div>
          <h2
            style={{
              fontSize: "2.4vw",
              fontWeight: 300,
              margin: 0,
              letterSpacing: "0.02em",
            }}
          >
            A Massive Market with No Clear Leader
          </h2>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          height: "75vh",
          padding: "7vh 10vw",
          gap: "4vw",
          alignItems: "stretch",
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
                fontSize: "0.85vw",
                fontWeight: 500,
                color: "#A0785A",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                marginBottom: "2vh",
              }}
            >
              TAM — Total Addressable Market
            </div>
            <div
              style={{
                fontSize: "5vw",
                fontWeight: 200,
                color: "#FFFFFF",
                lineHeight: 1,
              }}
            >
              $47B
            </div>
            <div
              style={{
                fontSize: "1vw",
                color: "#666666",
                marginTop: "1.5vh",
              }}
            >
              U.S. dump truck services market (2025)
            </div>
          </div>
          <p
            style={{
              fontSize: "1.05vw",
              color: "#888888",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Growing at 5.2% CAGR driven by infrastructure spending, housing
            starts, and the IIJA federal bill allocating $110B to roads and
            bridges.
          </p>
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
                fontSize: "0.85vw",
                fontWeight: 500,
                color: "#888888",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                marginBottom: "2vh",
              }}
            >
              SAM — Serviceable Addressable Market
            </div>
            <div
              style={{
                fontSize: "5vw",
                fontWeight: 200,
                color: "#FFFFFF",
                lineHeight: 1,
              }}
            >
              $12B
            </div>
            <div
              style={{
                fontSize: "1vw",
                color: "#666666",
                marginTop: "1.5vh",
              }}
            >
              Short-haul dispatch across all 50 U.S. states
            </div>
          </div>
          <p
            style={{
              fontSize: "1.05vw",
              color: "#888888",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Every U.S. state has active construction and dump truck demand. No
            national platform exists — all 50 states operate on legacy dispatch,
            phone calls, and paper tickets today.
          </p>
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
                fontSize: "0.85vw",
                fontWeight: 500,
                color: "#888888",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                marginBottom: "2vh",
              }}
            >
              SOM — Serviceable Obtainable Market
            </div>
            <div
              style={{
                fontSize: "5vw",
                fontWeight: 200,
                color: "#FFFFFF",
                lineHeight: 1,
              }}
            >
              $480M
            </div>
            <div
              style={{
                fontSize: "1vw",
                color: "#666666",
                marginTop: "1.5vh",
              }}
            >
              U.S. national platform GMV target (Year 3)
            </div>
          </div>
          <p
            style={{
              fontSize: "1.05vw",
              color: "#888888",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Capturing 1% of the national short-haul market in 36 months via a
            Texas-first rollout scaling to all 50 states, with Canada, Mexico,
            and global markets as subsequent phases.
          </p>
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
        <span>
          HaulBrokr&nbsp;&bull;&nbsp;Confidential&nbsp;&bull;&nbsp;2026
        </span>
        <span style={{ color: "#A0785A" }}>07</span>
      </div>
    </div>
  );
}
