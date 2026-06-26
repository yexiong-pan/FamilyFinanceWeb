import { useMemo } from "react";
import { theme } from "antd";
import type { ConfigProviderProps } from "antd";
import { createStyles } from "antd-style";

export const illustrationThemeTokens = {
  colorText: "#2C2C2C",
  colorPrimary: "#52C41A",
  colorSuccess: "#51CF66",
  colorWarning: "#FFD93D",
  colorError: "#FA5252",
  colorInfo: "#4DABF7",
  colorBorder: "#2C2C2C",
  colorBorderSecondary: "#2C2C2C",
  lineWidth: 3,
  lineWidthBold: 3,
  borderRadius: 12,
  borderRadiusLG: 16,
  borderRadiusSM: 8,
  controlHeight: 40,
  controlHeightSM: 34,
  controlHeightLG: 48,
  fontSize: 15,
  fontWeightStrong: 600,
  colorBgBase: "#FFF9F0",
  colorBgContainer: "#FFFFFF"
} as const;

const useStyles = createStyles(({ css, token }) => {
  const illustrationBorder = css({
    border: `${token.lineWidth}px solid ${token.colorBorder}`
  });

  const illustrationBox = css({
    border: `${token.lineWidth}px solid ${token.colorBorder}`,
    boxShadow: `4px 4px 0 ${token.colorBorder}`
  });

  return {
    illustrationBorder,
    illustrationBox,
    buttonRoot: css({
      border: `${token.lineWidth}px solid ${token.colorBorder}`,
      boxShadow: `4px 4px 0 ${token.colorBorder}`,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: 0
    }),
    modalContainer: css({
      border: `${token.lineWidth}px solid ${token.colorBorder}`,
      boxShadow: `4px 4px 0 ${token.colorBorder}`
    }),
    tooltipRoot: css({
      padding: token.padding
    }),
    popupBox: css({
      border: `${token.lineWidth}px solid ${token.colorBorder}`,
      boxShadow: `4px 4px 0 ${token.colorBorder}`,
      borderRadius: token.borderRadiusLG,
      backgroundColor: token.colorBgContainer
    }),
    progressRail: css({
      border: `${token.lineWidth}px solid ${token.colorBorder}`,
      boxShadow: `2px 2px 0 ${token.colorBorder}`
    }),
    progressTrack: css({
      border: "none"
    }),
    inputNumberActions: css({
      width: 12
    })
  };
});

const useIllustrationTheme = () => {
  const { styles } = useStyles();

  return useMemo<ConfigProviderProps>(
    () => ({
      theme: {
        algorithm: theme.defaultAlgorithm,
        token: illustrationThemeTokens,
        components: {
          Button: {
            primaryShadow: "none",
            dangerShadow: "none",
            defaultShadow: "none",
            fontWeight: 600
          },
          Modal: {
            boxShadow: "none"
          },
          Card: {
            boxShadow: "4px 4px 0 #2C2C2C",
            colorBgContainer: "#FFF0F6"
          },
          Tooltip: {
            colorBorder: "#2C2C2C",
            colorBgSpotlight: "rgba(100, 100, 100, 0.95)",
            borderRadius: 8
          },
          Select: {
            optionSelectedBg: "transparent"
          },
          Slider: {
            dotBorderColor: "#237804",
            dotActiveBorderColor: "#237804",
            colorPrimaryBorder: "#237804",
            colorPrimaryBorderHover: "#237804"
          },
          Layout: {
            bodyBg: "#FFF9F0",
            headerBg: "#FFFFFF",
            siderBg: "#FFFFFF"
          },
          Menu: {
            itemSelectedBg: "#E6F4FF",
            itemSelectedColor: "#2C2C2C",
            itemHoverBg: "#FFF0F6"
          },
          Table: {
            headerBg: "#E6F4FF",
            rowHoverBg: "#FFF9F0"
          }
        }
      },
      button: {
        className: styles.buttonRoot
      },
      modal: {
        className: styles.modalContainer
      },
      alert: {
        className: styles.illustrationBorder
      },
      colorPicker: {
        className: styles.illustrationBox
      },
      popover: {
        className: styles.illustrationBox
      },
      tooltip: {
        className: styles.tooltipRoot
      },
      dropdown: {
        className: styles.popupBox
      },
      select: {
        className: styles.illustrationBox
      },
      input: {
        className: styles.illustrationBox
      },
      inputNumber: {
        className: styles.illustrationBox
      },
      progress: {
        className: styles.progressRail
      }
    }),
    [styles]
  );
};

export default useIllustrationTheme;
