import { CloseOutlined, MenuOutlined } from "@ant-design/icons";
import type { DragEndEvent } from "@dnd-kit/core";
import { DndContext, PointerSensor, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { FloatButton } from "antd";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState
} from "react";
import type { PageKey } from "./navigation";

const BUTTON_SIZE = 52;
const EDGE_GAP = 12;
const TOP_GAP = 64;
const BOTTOM_GAP = 20;
const POSITION_STORAGE_KEY = "family-finance.mobile-navigation-position-v2";

export interface FloatingNavigationPosition {
  x: number;
  y: number;
}

interface NavigationItem {
  key: PageKey;
  label: string;
  icon: ReactNode;
}

interface MobileFloatingNavigationProps {
  activePage: PageKey;
  items: NavigationItem[];
  onNavigate: (page: PageKey) => void;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function clampFloatingNavigationPosition(
  position: FloatingNavigationPosition,
  viewportWidth: number,
  viewportHeight: number
): FloatingNavigationPosition {
  const maxX = Math.max(EDGE_GAP, viewportWidth - BUTTON_SIZE - EDGE_GAP);
  const maxY = Math.max(TOP_GAP, viewportHeight - BUTTON_SIZE - BOTTOM_GAP);

  return {
    x: clamp(position.x, EDGE_GAP, maxX),
    y: clamp(position.y, TOP_GAP, maxY)
  };
}

function defaultPosition() {
  return clampFloatingNavigationPosition(
    {
      x: 16,
      y: window.innerHeight - BUTTON_SIZE - 28
    },
    window.innerWidth,
    window.innerHeight
  );
}

function initialPosition() {
  const fallback = defaultPosition();
  const saved = window.localStorage.getItem(POSITION_STORAGE_KEY);
  if (!saved) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(saved) as Partial<FloatingNavigationPosition>;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
      return fallback;
    }
    return clampFloatingNavigationPosition(parsed as FloatingNavigationPosition, window.innerWidth, window.innerHeight);
  } catch {
    return fallback;
  }
}

function navigationLabel(item: NavigationItem) {
  return item.key === "checkup" ? "盘点" : item.label;
}

function DraggableNavigationMenu({
  activePage,
  items,
  open,
  position,
  dragging,
  onNavigate,
  onOpenChange
}: {
  activePage: PageKey;
  items: NavigationItem[];
  open: boolean;
  position: FloatingNavigationPosition;
  dragging: boolean;
  onNavigate: (page: PageKey) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { listeners, setNodeRef, transform } = useDraggable({
    id: "mobile-navigation-float-button"
  });
  const mergedTransform = CSS.Translate.toString({
    x: position.x + (transform?.x ?? 0),
    y: position.y + (transform?.y ?? 0),
    scaleX: transform?.scaleX ?? 1,
    scaleY: transform?.scaleY ?? 1
  });
  const style: CSSProperties = {
    position: "fixed",
    insetInlineEnd: "auto",
    right: "auto",
    bottom: "auto",
    left: 0,
    top: 0,
    transform: mergedTransform,
    cursor: dragging ? "grabbing" : "grab",
    transition: dragging ? "none" : "transform 160ms ease",
    touchAction: "none"
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      className={[
        "mobile-floating-navigation",
        position.x <= (window.innerWidth - BUTTON_SIZE) / 2 ? "is-left-side" : "is-right-side"
      ].join(" ")}
      style={style}
    >
      <FloatButton.Group
        aria-label="主导航"
        className="mobile-floating-navigation-group"
        closeIcon={<CloseOutlined />}
        icon={<MenuOutlined />}
        open={open}
        placement={position.y > window.innerHeight / 2 ? "top" : "bottom"}
        shape="circle"
        style={{ position: "static" }}
        trigger="click"
        type="primary"
        onOpenChange={onOpenChange}
      >
        {items.map((item) => (
          <FloatButton
            key={item.key}
            aria-current={activePage === item.key ? "page" : undefined}
            aria-label={navigationLabel(item)}
            icon={item.icon}
            type={activePage === item.key ? "primary" : "default"}
            onClick={() => onNavigate(item.key)}
          />
        ))}
      </FloatButton.Group>
    </div>
  );
}

export function MobileFloatingNavigation({
  activePage,
  items,
  onNavigate
}: MobileFloatingNavigationProps) {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState<FloatingNavigationPosition>(initialPosition);
  const suppressClickRef = useRef(false);
  const releaseClickTimerRef = useRef<number | undefined>(undefined);
  const sensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8
    }
  });
  const sensors = useSensors(sensor);

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => clampFloatingNavigationPosition(
        current,
        window.innerWidth,
        window.innerHeight
      ));
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (releaseClickTimerRef.current !== undefined) {
        window.clearTimeout(releaseClickTimerRef.current);
      }
    };
  }, []);

  const handleDragEnd = ({ delta }: DragEndEvent) => {
    setDragging(false);
    const nextPosition = clampFloatingNavigationPosition(
      {
        x: position.x + delta.x,
        y: position.y + delta.y
      },
      window.innerWidth,
      window.innerHeight
    );
    setPosition(nextPosition);
    window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(nextPosition));
    releaseClickTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const releaseSuppressedClick = () => {
    releaseClickTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  return (
    <>
      <DndContext
        id="mobile-navigation-dnd"
        sensors={sensors}
        onDragStart={() => {
          suppressClickRef.current = true;
          setOpen(false);
          setDragging(true);
        }}
        onDragCancel={() => {
          setDragging(false);
          releaseSuppressedClick();
        }}
        onDragEnd={handleDragEnd}
      >
        <DraggableNavigationMenu
          activePage={activePage}
          dragging={dragging}
          items={items}
          open={open}
          position={position}
          onNavigate={(page) => {
            setOpen(false);
            onNavigate(page);
          }}
          onOpenChange={(nextOpen) => {
            if (!suppressClickRef.current) {
              setOpen(nextOpen);
            }
          }}
        />
      </DndContext>
    </>
  );
}
