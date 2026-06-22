export default function Slide05HowItWorks1() {
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
            03 — How It Works
          </div>
          <h2
            style={{
              fontSize: "2.4vw",
              fontWeight: 300,
              margin: 0,
              letterSpacing: "0.02em",
            }}
          >
            From Request to Road in Four Steps
          </h2>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          height: "75vh",
          padding: "8vh 10vw",
          alignItems: "center",
          gap: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingRight: "2vw",
          }}
        >
          <div
            style={{
              width: "7vw",
              height: "7vw",
              borderRadius: "50%",
              border: "0.2vh solid #A0785A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "3vh",
            }}
          >
            <span style={{ fontSize: "2.5vw", fontWeight: 200, color: "#A0785A" }}>01</span>
          </div>
          <div
            style={{
              fontSize: "1.3vw",
              fontWeight: 500,
              color: "#FFFFFF",
              textAlign: "center",
              marginBottom: "1.5vh",
            }}
          >
            Post a Job
          </div>
          <div
            style={{
              fontSize: "1vw",
              color: "#888888",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            Contractor opens the app and enters material type, pickup location, drop site, and load count. Done in under 60 seconds.
          </div>
        </div>

        <div
          style={{
            fontSize: "1.5vw",
            color: "#333333",
            flexShrink: 0,
            padding: "0 1vw",
          }}
        >
          &#8250;
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "0 2vw",
          }}
        >
          <div
            style={{
              width: "7vw",
              height: "7vw",
              borderRadius: "50%",
              border: "0.2vh solid #333333",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "3vh",
            }}
          >
            <span style={{ fontSize: "2.5vw", fontWeight: 200, color: "#888888" }}>02</span>
          </div>
          <div
            style={{
              fontSize: "1.3vw",
              fontWeight: 500,
              color: "#FFFFFF",
              textAlign: "center",
              marginBottom: "1.5vh",
            }}
          >
            Smart Match
          </div>
          <div
            style={{
              fontSize: "1vw",
              color: "#888888",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            The platform instantly surfaces the nearest available, verified operators — sorted by proximity, rating, and truck type.
          </div>
        </div>

        <div
          style={{
            fontSize: "1.5vw",
            color: "#333333",
            flexShrink: 0,
            padding: "0 1vw",
          }}
        >
          &#8250;
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "0 2vw",
          }}
        >
          <div
            style={{
              width: "7vw",
              height: "7vw",
              borderRadius: "50%",
              border: "0.2vh solid #333333",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "3vh",
            }}
          >
            <span style={{ fontSize: "2.5vw", fontWeight: 200, color: "#888888" }}>03</span>
          </div>
          <div
            style={{
              fontSize: "1.3vw",
              fontWeight: 500,
              color: "#FFFFFF",
              textAlign: "center",
              marginBottom: "1.5vh",
            }}
          >
            Live Dispatch
          </div>
          <div
            style={{
              fontSize: "1vw",
              color: "#888888",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            Trucks are tracked in real time. Digital load tickets are generated at each dump cycle — no paper, no disputes.
          </div>
        </div>

        <div
          style={{
            fontSize: "1.5vw",
            color: "#333333",
            flexShrink: 0,
            padding: "0 1vw",
          }}
        >
          &#8250;
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingLeft: "2vw",
          }}
        >
          <div
            style={{
              width: "7vw",
              height: "7vw",
              borderRadius: "50%",
              border: "0.2vh solid #333333",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "3vh",
            }}
          >
            <span style={{ fontSize: "2.5vw", fontWeight: 200, color: "#888888" }}>04</span>
          </div>
          <div
            style={{
              fontSize: "1.3vw",
              fontWeight: 500,
              color: "#FFFFFF",
              textAlign: "center",
              marginBottom: "1.5vh",
            }}
          >
            Auto-Invoice
          </div>
          <div
            style={{
              fontSize: "1vw",
              color: "#888888",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            When the job closes, the platform auto-generates an itemized invoice. Contractors pay in-app; operators receive same-day deposit.
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
        <span style={{ color: "#A0785A" }}>05</span>
      </div>
    </div>
  );
}
