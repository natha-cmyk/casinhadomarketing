export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#EDEDEC",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif',
        color: "#121111",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "40px 44px",
          boxShadow: "0 1px 2px rgba(0,0,0,.04), 0 8px 40px rgba(0,0,0,.06)",
          textAlign: "center",
          maxWidth: 460,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            margin: "0 auto 18px",
            borderRadius: 14,
            display: "grid",
            placeItems: "center",
            color: "#fff",
            fontWeight: 800,
            fontSize: 24,
            background: "linear-gradient(135deg, #FF001E, #00BBC5)",
          }}
        >
          C
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>
          Casinha do Marketing
        </h1>
        <p style={{ margin: "0 0 18px", color: "#6E6E73", fontSize: 14 }}>
          Seahub Coworking · Natal/RN
        </p>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
            color: "#2FB457",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#2FB457",
            }}
          />
          Casinha no ar
        </span>
      </div>
    </main>
  );
}
