export default function Slide04Solution() {
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
            02 — The Solution
          </div>
          <h2
            style={{
              fontSize: "2.4vw",
              fontWeight: 300,
              margin: 0,
              letterSpacing: "0.02em",
            }}
          >
            One Platform. Both Sides of the Market.
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
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "4vh",
          }}
        >
          <p
            style={{
              fontSize: "1.8vw",
              fontWeight: 300,
              color: "#FFFFFF",
              lineHeight: 1.5,
              margin: 0,
              maxWidth: "34vw",
            }}
          >
            HaulBrokr is the real-time dispatch and marketplace layer that connects contractors with licensed dump truck operators — the way Uber connects riders to drivers.
          </p>

          <p
            style={{
              fontSize: "1.2vw",
              color: "#888888",
              lineHeight: 1.7,
              margin: 0,
              maxWidth: "32vw",
            }}
          >
            Contractors post a hauling job in under 60 seconds. Our platform matches them with the nearest available, fully vetted operator. Dispatch, tracking, ticketing, and invoicing all happen inside a single app.
          </p>

          <div
            style={{
              display: "flex",
              gap: "3vw",
              marginTop: "2vh",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "2.5vw",
                  fontWeight: 200,
                  color: "#A0785A",
                }}
              >
                60s
              </div>
              <div style={{ fontSize: "0.9vw", color: "#666666", marginTop: "0.5vh" }}>
                Time to book a truck
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "2.5vw",
                  fontWeight: 200,
                  color: "#A0785A",
                }}
              >
                100%
              </div>
              <div style={{ fontSize: "0.9vw", color: "#666666", marginTop: "0.5vh" }}>
                Compliance verified
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "2.5vw",
                  fontWeight: 200,
                  color: "#A0785A",
                }}
              >
                Auto
              </div>
              <div style={{ fontSize: "0.9vw", color: "#666666", marginTop: "0.5vh" }}>
                Digital invoicing
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
            gap: "3.5vh",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.8vw" }}>
            <div
              style={{
                fontSize: "1.2vw",
                fontWeight: 300,
                color: "#A0785A",
                flexShrink: 0,
                minWidth: "2.5vw",
              }}
            >
              01
            </div>
            <div>
              <div style={{ fontSize: "1.2vw", fontWeight: 500, color: "#FFFFFF", marginBottom: "0.5vh" }}>
                Contractor App
              </div>
              <div style={{ fontSize: "1vw", color: "#888888", lineHeight: 1.5 }}>
                Post jobs, track trucks in real time, receive digital load tickets, and pay — all in one place.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.8vw" }}>
            <div
              style={{
                fontSize: "1.2vw",
                fontWeight: 300,
                color: "#A0785A",
                flexShrink: 0,
                minWidth: "2.5vw",
              }}
            >
              02
            </div>
            <div>
              <div style={{ fontSize: "1.2vw", fontWeight: 500, color: "#FFFFFF", marginBottom: "0.5vh" }}>
                Operator App
              </div>
              <div style={{ fontSize: "1vw", color: "#888888", lineHeight: 1.5 }}>
                Receive job alerts, accept or decline, navigate to sites, and get paid same-day via direct deposit.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.8vw" }}>
            <div
              style={{
                fontSize: "1.2vw",
                fontWeight: 300,
                color: "#A0785A",
                flexShrink: 0,
                minWidth: "2.5vw",
              }}
            >
              03
            </div>
            <div>
              <div style={{ fontSize: "1.2vw", fontWeight: 500, color: "#FFFFFF", marginBottom: "0.5vh" }}>
                Admin Platform
              </div>
              <div style={{ fontSize: "1vw", color: "#888888", lineHeight: 1.5 }}>
                Broker dashboard for managing fleets, verifying credentials, and monitoring jobs across all accounts.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.8vw" }}>
            <div
              style={{
                fontSize: "1.2vw",
                fontWeight: 300,
                color: "#A0785A",
                flexShrink: 0,
                minWidth: "2.5vw",
              }}
            >
              04
            </div>
            <div>
              <div style={{ fontSize: "1.2vw", fontWeight: 500, color: "#FFFFFF", marginBottom: "0.5vh" }}>
                Fleet SaaS Layer
              </div>
              <div style={{ fontSize: "1vw", color: "#888888", lineHeight: 1.5 }}>
                White-label dispatch tools for regional brokerage firms managing their own driver networks.
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
        <span style={{ color: "#A0785A" }}>04</span>
      </div>
    </div>
  );
}
