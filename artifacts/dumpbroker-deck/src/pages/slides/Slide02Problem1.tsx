export default function Slide02Problem1() {
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
            A Fragmented, Analog Industry
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
        <div
          style={{
            flex: "0 0 22vw",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: "10vw",
              fontWeight: 200,
              color: "#A0785A",
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            $47B
          </div>
          <div
            style={{
              fontSize: "1vw",
              color: "#888888",
              marginTop: "2vh",
              lineHeight: 1.5,
            }}
          >
            U.S. dump truck market operating with no unified digital dispatch layer
          </div>
        </div>

        <div
          style={{
            flex: 1,
            borderLeft: "0.1vh solid #333333",
            paddingLeft: "5vw",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "4vh",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "2vw" }}>
            <div
              style={{
                width: "0.5vw",
                height: "0.5vw",
                backgroundColor: "#A0785A",
                marginTop: "0.9vh",
                flexShrink: 0,
              }}
            />
            <div>
              <div
                style={{
                  fontSize: "1.3vw",
                  fontWeight: 500,
                  color: "#FFFFFF",
                  marginBottom: "0.6vh",
                }}
              >
                Phone-tag dispatch
              </div>
              <div style={{ fontSize: "1.1vw", color: "#888888", lineHeight: 1.5 }}>
                Contractors spend hours calling individual owner-operators to find available trucks, wasting time on every job.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "2vw" }}>
            <div
              style={{
                width: "0.5vw",
                height: "0.5vw",
                backgroundColor: "#A0785A",
                marginTop: "0.9vh",
                flexShrink: 0,
              }}
            />
            <div>
              <div
                style={{
                  fontSize: "1.3vw",
                  fontWeight: 500,
                  color: "#FFFFFF",
                  marginBottom: "0.6vh",
                }}
              >
                No price transparency
              </div>
              <div style={{ fontSize: "1.1vw", color: "#888888", lineHeight: 1.5 }}>
                Rates vary wildly. There is no market rate. Operators undercharge; contractors overpay or get ghosted entirely.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "2vw" }}>
            <div
              style={{
                width: "0.5vw",
                height: "0.5vw",
                backgroundColor: "#A0785A",
                marginTop: "0.9vh",
                flexShrink: 0,
              }}
            />
            <div>
              <div
                style={{
                  fontSize: "1.3vw",
                  fontWeight: 500,
                  color: "#FFFFFF",
                  marginBottom: "0.6vh",
                }}
              >
                Paper invoicing and disputes
              </div>
              <div style={{ fontSize: "1.1vw", color: "#888888", lineHeight: 1.5 }}>
                Load counts are handwritten. Disputes are common. Payments are slow — net-30 or worse.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "2vw" }}>
            <div
              style={{
                width: "0.5vw",
                height: "0.5vw",
                backgroundColor: "#A0785A",
                marginTop: "0.9vh",
                flexShrink: 0,
              }}
            />
            <div>
              <div
                style={{
                  fontSize: "1.3vw",
                  fontWeight: 500,
                  color: "#FFFFFF",
                  marginBottom: "0.6vh",
                }}
              >
                Compliance blind spots
              </div>
              <div style={{ fontSize: "1.1vw", color: "#888888", lineHeight: 1.5 }}>
                Contractors have no way to verify insurance, licensing, or DOT compliance before a truck shows up on site.
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
        <span style={{ color: "#A0785A" }}>02</span>
      </div>
    </div>
  );
}
