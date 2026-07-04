export default function Slide03Problem2() {
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
            01 — The Problem
          </div>
          <h2
            style={{
              fontSize: "2.4vw",
              fontWeight: 300,
              margin: 0,
              letterSpacing: "0.02em",
            }}
          >
            The Cost of Inefficiency
          </h2>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          height: "75vh",
          padding: "7vh 10vw",
          gap: "4vw",
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
              Contractor Pain
            </div>
            <div
              style={{
                fontSize: "4.5vw",
                fontWeight: 200,
                color: "#FFFFFF",
                lineHeight: 1,
              }}
            >
              3.2 hrs
            </div>
            <div
              style={{
                fontSize: "1vw",
                color: "#666666",
                marginTop: "1.5vh",
              }}
            >
              Average time lost per job sourcing trucks via phone
            </div>
          </div>
          <p
            style={{
              fontSize: "1.1vw",
              color: "#888888",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Foremen leave job sites to make calls. Projects stall. Deadlines
            slip. General contractors pass penalties downstream.
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
              Operator Pain
            </div>
            <div
              style={{
                fontSize: "4.5vw",
                fontWeight: 200,
                color: "#FFFFFF",
                lineHeight: 1,
              }}
            >
              38%
            </div>
            <div
              style={{
                fontSize: "1vw",
                color: "#666666",
                marginTop: "1.5vh",
              }}
            >
              Average truck idle time — revenue-destroying deadhead miles
            </div>
          </div>
          <p
            style={{
              fontSize: "1.1vw",
              color: "#888888",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Owner-operators rely on word-of-mouth. When a relationship ends,
            cash flow collapses overnight with no backup pipeline.
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
              Market Pain
            </div>
            <div
              style={{
                fontSize: "4.5vw",
                fontWeight: 200,
                color: "#FFFFFF",
                lineHeight: 1,
              }}
            >
              $8.2B
            </div>
            <div
              style={{
                fontSize: "1vw",
                color: "#666666",
                marginTop: "1.5vh",
              }}
            >
              Estimated annual value lost to dispatch inefficiency nationwide
            </div>
          </div>
          <p
            style={{
              fontSize: "1.1vw",
              color: "#888888",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            No incumbent has built a scalable two-sided marketplace. The space
            is ripe for a modern platform with real network effects.
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
        <span style={{ color: "#A0785A" }}>03</span>
      </div>
    </div>
  );
}
