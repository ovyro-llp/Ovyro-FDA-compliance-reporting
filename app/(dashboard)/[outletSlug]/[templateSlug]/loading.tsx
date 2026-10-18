export default function LoadingTemplateSheet() {
  return (
    <div
      style={{
        padding: "1.5rem 1rem",
        maxWidth: "960px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      {/* Header skeleton */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          padding: "1.5rem",
          border: "1px solid #e6dfd5",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <div
          style={{
            width: "120px",
            height: "24px",
            borderRadius: "6px",
            background: "#f1f5f9",
          }}
        />
        <div
          style={{
            width: "60%",
            height: "32px",
            borderRadius: "8px",
            background: "#f1f5f9",
          }}
        />
        <div
          style={{
            width: "40%",
            height: "18px",
            borderRadius: "6px",
            background: "#f8fafc",
          }}
        />
      </div>

      {/* Checklist items skeleton */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          padding: "1.5rem",
          border: "1px solid #e6dfd5",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              padding: "0.85rem",
              borderRadius: "10px",
              background: "#f8f6f1",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ width: "50%", height: "20px", borderRadius: "6px", background: "#e2e8f0" }} />
            <div style={{ width: "80px", height: "28px", borderRadius: "6px", background: "#cbd5e1" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
