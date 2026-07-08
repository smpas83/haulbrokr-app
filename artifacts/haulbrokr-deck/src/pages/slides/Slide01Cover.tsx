export default function Slide01Cover() {
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
      <img
        src={`${import.meta.env.BASE_URL}hero-cover.png`}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.35,
        }}
        alt=""
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(20,20,20,0.3) 0%, rgba(20,20,20,0.85) 60%, #141414 100%)",
        }}
      />

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
          top: 0,
          left: 0,
          right: 0,
          height: "70vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 15vw",
        }}
      >
        <div
          style={{
            fontSize: "0.85vw",
            fontWeight: 600,
            color: "#A0785A",
            textTransform: "uppercase",
            letterSpacing: "0.35em",
            marginBottom: "3vh",
          }}
        >
          Founding Partner Presentation
        </div>

        <img
          src={`${import.meta.env.BASE_URL}haulbrokr-logo.png`}
          alt="HaulBrokr"
          style={{
            width: "42vw",
            maxWidth: "640px",
            height: "auto",
            margin: 0,
          }}
        />

        <div
          style={{
            width: "6vw",
            height: "0.15vh",
            backgroundColor: "#A0785A",
            margin: "4vh auto",
          }}
        />

        <p
          style={{
            fontSize: "1.5vw",
            fontWeight: 300,
            color: "#CCCCCC",
            margin: 0,
            maxWidth: "48vw",
            lineHeight: 1.5,
            letterSpacing: "0.03em",
          }}
        >
          The Digital Marketplace for Heavy Hauling
        </p>

        <p
          style={{
            fontSize: "1.1vw",
            fontWeight: 400,
            color: "#888888",
            marginTop: "3vh",
            maxWidth: "40vw",
            lineHeight: 1.6,
          }}
        >
          Connecting contractors with licensed dump truck operators across Texas
          — on demand, in real time.
        </p>
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
