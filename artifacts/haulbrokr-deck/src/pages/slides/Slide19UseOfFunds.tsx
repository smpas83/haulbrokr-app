export default function Slide19UseOfFunds() {
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
            10 — Investment
          </div>
          <h2
            style={{
              fontSize: "2.4vw",
              fontWeight: 300,
              margin: 0,
              letterSpacing: "0.02em",
            }}
          >
            How Capital Gets Deployed
          </h2>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          height: "75vh",
          padding: "6vh 10vw",
          gap: "6vw",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "3vh",
          }}
        >
          <div
            style={{
              fontSize: "1.1vw",
              fontWeight: 500,
              color: "#A0785A",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "0.5vh",
            }}
          >
            Seed Capital — Year 1 Deployment
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2vh" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "2vw" }}>
              <div
                style={{
                  fontSize: "1.2vw",
                  fontWeight: 500,
                  color: "#A0785A",
                  minWidth: "5vw",
                }}
              >
                40%
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: "0.8vh",
                    backgroundColor: "#A0785A",
                    width: "40%",
                    marginBottom: "0.8vh",
                  }}
                />
                <div
                  style={{
                    fontSize: "1.1vw",
                    color: "#FFFFFF",
                    marginBottom: "0.3vh",
                  }}
                >
                  Product &amp; Engineering
                </div>
                <div style={{ fontSize: "0.9vw", color: "#666666" }}>
                  Feature buildout, infrastructure hardening, mobile app
                  iteration
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "2vw" }}>
              <div
                style={{
                  fontSize: "1.2vw",
                  fontWeight: 500,
                  color: "#888888",
                  minWidth: "5vw",
                }}
              >
                25%
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: "0.8vh",
                    backgroundColor: "#555555",
                    width: "25%",
                    marginBottom: "0.8vh",
                  }}
                />
                <div
                  style={{
                    fontSize: "1.1vw",
                    color: "#FFFFFF",
                    marginBottom: "0.3vh",
                  }}
                >
                  Supply Acquisition
                </div>
                <div style={{ fontSize: "0.9vw", color: "#666666" }}>
                  Operator onboarding, CDL verification partnerships, incentive
                  budget
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "2vw" }}>
              <div
                style={{
                  fontSize: "1.2vw",
                  fontWeight: 500,
                  color: "#888888",
                  minWidth: "5vw",
                }}
              >
                20%
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: "0.8vh",
                    backgroundColor: "#444444",
                    width: "20%",
                    marginBottom: "0.8vh",
                  }}
                />
                <div
                  style={{
                    fontSize: "1.1vw",
                    color: "#FFFFFF",
                    marginBottom: "0.3vh",
                  }}
                >
                  Demand Marketing
                </div>
                <div style={{ fontSize: "0.9vw", color: "#666666" }}>
                  Contractor acquisition: trade shows, direct sales, LinkedIn
                  outreach
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "2vw" }}>
              <div
                style={{
                  fontSize: "1.2vw",
                  fontWeight: 500,
                  color: "#888888",
                  minWidth: "5vw",
                }}
              >
                10%
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: "0.8vh",
                    backgroundColor: "#333333",
                    width: "10%",
                    marginBottom: "0.8vh",
                  }}
                />
                <div
                  style={{
                    fontSize: "1.1vw",
                    color: "#FFFFFF",
                    marginBottom: "0.3vh",
                  }}
                >
                  Legal &amp; Compliance
                </div>
                <div style={{ fontSize: "0.9vw", color: "#666666" }}>
                  SHA, employment agreements, DOT regulatory counsel, state
                  licensing
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "2vw" }}>
              <div
                style={{
                  fontSize: "1.2vw",
                  fontWeight: 500,
                  color: "#888888",
                  minWidth: "5vw",
                }}
              >
                5%
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: "0.8vh",
                    backgroundColor: "#2A2A2A",
                    width: "5%",
                    marginBottom: "0.8vh",
                  }}
                />
                <div
                  style={{
                    fontSize: "1.1vw",
                    color: "#FFFFFF",
                    marginBottom: "0.3vh",
                  }}
                >
                  Operations Reserve
                </div>
                <div style={{ fontSize: "0.9vw", color: "#666666" }}>
                  6-month runway buffer, unforeseen city launch costs
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            flex: "0 0 28vw",
            borderLeft: "0.1vh solid #333333",
            paddingLeft: "5vw",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "3.5vh",
          }}
        >
          <div
            style={{
              fontSize: "1.1vw",
              fontWeight: 500,
              color: "#A0785A",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            18-Month Milestones Funded
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "2.5vh" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "1.5vw",
              }}
            >
              <div
                style={{
                  width: "0.5vw",
                  height: "0.5vw",
                  backgroundColor: "#A0785A",
                  marginTop: "0.8vh",
                  flexShrink: 0,
                }}
              />
              <span
                style={{ fontSize: "1.1vw", color: "#888888", lineHeight: 1.5 }}
              >
                Houston public launch with 200+ active operators and 20
                contractor accounts
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "1.5vw",
              }}
            >
              <div
                style={{
                  width: "0.5vw",
                  height: "0.5vw",
                  backgroundColor: "#A0785A",
                  marginTop: "0.8vh",
                  flexShrink: 0,
                }}
              />
              <span
                style={{ fontSize: "1.1vw", color: "#888888", lineHeight: 1.5 }}
              >
                DFW expansion reaching $10M annualized GMV run rate
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "1.5vw",
              }}
            >
              <div
                style={{
                  width: "0.5vw",
                  height: "0.5vw",
                  backgroundColor: "#A0785A",
                  marginTop: "0.8vh",
                  flexShrink: 0,
                }}
              />
              <span
                style={{ fontSize: "1.1vw", color: "#888888", lineHeight: 1.5 }}
              >
                Fleet SaaS launched with 3 paying brokerage subscribers
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "1.5vw",
              }}
            >
              <div
                style={{
                  width: "0.5vw",
                  height: "0.5vw",
                  backgroundColor: "#A0785A",
                  marginTop: "0.8vh",
                  flexShrink: 0,
                }}
              />
              <span
                style={{ fontSize: "1.1vw", color: "#888888", lineHeight: 1.5 }}
              >
                Series A metrics achieved — unit economics proven, NPS above 70
              </span>
            </div>
          </div>

          <div
            style={{
              padding: "2.5vh 2.5vw",
              backgroundColor: "#1A1A1A",
              borderLeft: "0.3vh solid #A0785A",
              marginTop: "1vh",
            }}
          >
            <div
              style={{
                fontSize: "0.85vw",
                color: "#A0785A",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "1vh",
              }}
            >
              Burn Rate Target
            </div>
            <div
              style={{ fontSize: "1.5vw", fontWeight: 200, color: "#FFFFFF" }}
            >
              18 months runway
            </div>
            <div
              style={{
                fontSize: "0.9vw",
                color: "#666666",
                marginTop: "0.8vh",
              }}
            >
              Seed capital structured to reach Series A readiness without bridge
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
        <span>
          HaulBrokr&nbsp;&bull;&nbsp;Confidential&nbsp;&bull;&nbsp;2026
        </span>
        <span style={{ color: "#A0785A" }}>19</span>
      </div>
    </div>
  );
}
