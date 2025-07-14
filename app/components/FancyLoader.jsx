// components/FancyLoader.jsx
import React from "react";

const FancyLoader = ({ size = 24, color = "text-emerald-400" }) => {
  return (
    <div className={`flex items-center justify-center mr-3 ${color}`}>
      <div
        className="animate-spin rounded-full border-2 border-t-2 border-emerald-400 border-opacity-25"
        style={{ width: size, height: size, borderTopColor: "currentColor" }}
      ></div>
    </div>
  );
};

export default FancyLoader;
