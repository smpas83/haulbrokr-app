export default function Slide20CTA() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        backgroundColor: "#141414",
        fontFamily: "'Inter', sans-serif",
        color: "#FFFFFF",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "70vh",
          left: 0,
          width: "100vw",
          height: "0.15vh",
          backgroundColor: "#A0785A",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "70vh",
          padding: "0 18vw",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "0.85vw",
            fontWeight: 500,
            color: "#A0785A",
            textTransform: "uppercase",
            letterSpacing: "0.35em",
            marginBottom: "4vh",
          }}
        >
          Join the Foundation
        </div>

        <h1
          style={{
            fontSize: "4.5vw",
            fontWeight: 200,
            margin: 0,
            letterSpacing: "0.04em",
            lineHeight: 1.2,
            color: "#FFFFFF",
          }}
        >
          Build Something That Lasts
        </h1>

        <div
          style={{
            width: "5vw",
            height: "0.15vh",
            backgroundColor: "#A0785A",
            margin: "4vh auto",
          }}
        />

        <p
          style={{
            fontSize: "1.4vw",
            fontWeight: 300,
            color: "#CCCCCC",
            margin: 0,
            maxWidth: "46vw",
            lineHeight: 1.7,
          }}
        >
          The dump truck industry has been running on handshakes and cell phones
          for sixty years. We are building the infrastructure layer it has never
          had. We are looking for the right partners — not just capital, but
          people with conviction in the trade industries who want equity in a
          platform that will define this category.
        </p>

        <div
          style={{
            display: "flex",
            gap: "5vw",
            marginTop: "5vh",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "0.85vw",
                color: "#A0785A",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                marginBottom: "1vh",
              }}
            >
              Schedule a Call
            </div>
            <div style={{ fontSize: "1.1vw", color: "#FFFFFF" }}>
              founders@haulbrokr.com
            </div>
          </div>
          <div style={{ width: "0.1vh", backgroundColor: "#333333" }} />
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "0.85vw",
                color: "#888888",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                marginBottom: "1vh",
              }}
            >
              Platform Demo
            </div>
            <div style={{ fontSize: "1.1vw", color: "#888888" }}>
              haulbrokr.com/demo
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "30vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontSize: "0.8vw",
            fontWeight: 500,
            color: "#666666",
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.2vh",
          }}
        >
          <span style={{ color: "#A0785A" }}>haulbrokr.com</span>
          <span>HaulBrokr, Inc.</span>
          <span>Confidential&nbsp;&bull;&nbsp;May 2026</span>
        </div>
      </div>
    </div>
  );
}
