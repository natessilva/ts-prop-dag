function hasEnoughSpace(
    contentWidth: number,
    contentHeight: number,
    availableWidth: number,
    availableHeight: number): boolean {
    return contentWidth < availableWidth && contentHeight < availableHeight;
}

class View {
    public static createCenter(
        width: number,
        height: number,
        contentWidth: number,
        contentHeight: number,
        contentMargin: number): View {
        return new View(
            width,
            height,
            contentWidth,
            contentHeight,
            (width - contentWidth) / 2,
            (height - contentHeight) / 2,
            1,
            contentMargin);
    }

    public static createFit(
        width: number,
        height: number,
        contentWidth: number,
        contentHeight: number,
        contentMargin: number): View {
        const availableWidth = width - contentMargin * 2;
        const availableHeight = height - contentMargin * 2;
        const zoom = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);

        return new View(
            width,
            height,
            contentWidth,
            contentHeight,
            (width - contentWidth * zoom) / 2,
            (height - contentHeight * zoom) / 2,
            zoom,
            contentMargin);
    }

    private constructor(
        public width: number,
        public height: number,
        public contentWidth: number,
        public contentHeight: number,
        public contentX: number,
        public contentY: number,
        public zoom: number,
        public contentMargin: number) {
    }

    public get availableWidth(): number {
        return this.width - this.contentMargin * 2;
    }

    public get availableHeight(): number {
        return this.height - this.contentHeight * 2;
    }

    public center(): void {
        this.contentX = (this.width - this.contentWidth * this.zoom) / 2;
        this.contentY = (this.height - this.contentHeight * this.zoom) / 2;
    }

    public fit(): void {
        this.zoom = Math.min(this.availableWidth / this.contentWidth, this.availableHeight / this.contentHeight);

        this.center();
    }

    public zoomTo(x: number, y: number, value: number): void {
        const ratio = value / this.zoom;

        this.contentX = x - (x - this.contentX) * ratio;
        this.contentY = y - (y - this.contentY) * ratio;
    }
}

export enum ZoomMode {
    Fixed,
    Fit,
    AutoFit,
}

interface IViewState {
    readonly zoomMode: number;

    decay(callback: (viewState: IViewState) => void): void;
    resize(view: View, width: number, height: number): IViewState;
    toggleOverview(view: View, x: number, y: number): IViewState;
}

abstract class FixedState implements IViewState {
    public static create(
        width: number,
        height: number,
        contentWidth: number,
        contentHeight: number,
        contentMargin: number): [View, FixedState] {
        const availableWidth = width - contentMargin * 2;
        const availableHeight = height - contentMargin * 2;

        if (hasEnoughSpace(contentWidth, contentHeight, availableWidth, availableHeight)) {
            return [
                View.createCenter(width, height, contentWidth, contentHeight, contentMargin),
                new Fixed100PercentState(1.0),
            ];
        } else {
            return [View.createFit(width, height, contentWidth, contentHeight, contentMargin), new FixedNormalState()];
        }
    }

    public readonly zoomMode = ZoomMode.Fixed;

    public decay(): void {
        // No effect.
    }

    public resize(view: View, width: number, height: number): IViewState {
        view.contentX += (width - view.width) / 2;
        view.contentY += (height - view.height) / 2;
        view.width = width;
        view.height = height;

        return this;
    }

    public abstract toggleOverview(view: View, x: number, y: number): IViewState;
}

class FixedNormalState extends FixedState {
    public toggleOverview(view: View, x: number, y: number): IViewState {
        const savedZoom = view.zoom;

        view.zoomTo(x, y, 1);

        return new Fixed100PercentState(savedZoom);
    }
}

class Fixed100PercentState extends FixedState {
    public constructor(private savedZoom: number) {
        super();
    }

    public toggleOverview(view: View): IViewState {
        view.fit();

        return new FitState(this.savedZoom);
    }
}

class FitState implements IViewState {
    public static create(
        width: number,
        height: number,
        contentWidth: number,
        contentHeight: number,
        contentMargin: number): [View, FitState] {
        return [View.createFit(width, height, contentWidth, contentHeight, contentMargin), new FitState(1.0)];
    }

    public readonly zoomMode = ZoomMode.Fit;

    public constructor(private savedZoom: number) {
    }

    public decay(callback: (viewState: IViewState) => void): void {
        callback(new FixedNormalState());
    }

    public resize(view: View, width: number, height: number): IViewState {
        view.width = width;
        view.height = height;

        view.fit();

        return this;
    }

    public toggleOverview(view: View, x: number, y: number): IViewState {
        view.zoomTo(x, y, this.savedZoom);

        return new FixedNormalState();
    }
}

abstract class AutoFitState implements IViewState {

    public static create(
        width: number,
        height: number,
        contentWidth: number,
        contentHeight: number,
        contentMargin: number): [View, AutoFitState] {
        const availableWidth = width - contentMargin * 2;
        const availableHeight = height - contentMargin * 2;

        if (hasEnoughSpace(contentWidth, contentHeight, availableWidth, availableHeight)) {
            return [
                View.createCenter(width, height, contentWidth, contentHeight, contentMargin),
                new AutoFit100PercentState(1.0),
            ];
        } else {
            return [
                View.createFit(width, height, contentWidth, contentHeight, contentMargin),
                new AutoFitFitState(1.0),
            ];
        }
    }

    public readonly zoomMode = ZoomMode.AutoFit;

    public constructor(protected savedZoom: number) {
    }

    public abstract decay(callback: (viewState: IViewState) => void): void;
    public abstract resize(view: View, width: number, height: number): IViewState;
    public abstract toggleOverview(view: View, x: number, y: number): IViewState;
}

class AutoFit100PercentState extends AutoFitState {
    public constructor(savedZoom: number) {
        super(savedZoom);
    }

    public decay(callback: (viewState: IViewState) => void): void {
        callback(new Fixed100PercentState(this.savedZoom));
    }

    public resize(view: View, width: number, height: number): IViewState {
        view.width = width;
        view.height = height;

        if (view.contentWidth < view.availableWidth && view.contentHeight < view.availableHeight) {
            view.center();

            return this;
        } else {
            view.fit();

            return new AutoFitFitState(this.savedZoom);
        }
    }

    public toggleOverview(view: View): IViewState {
        view.fit();

        return new FitState(this.savedZoom);
    }
}

class AutoFitFitState extends AutoFitState {
    public constructor(savedZoom: number) {
        super(savedZoom);
    }

    public decay(callback: (viewState: IViewState) => void): void {
        callback(new FixedNormalState());
    }

    public resize(view: View, width: number, height: number): IViewState {
        view.width = width;
        view.height = height;

        if (view.contentWidth < view.availableWidth && view.contentHeight < view.availableHeight) {
            view.center();

            return new AutoFit100PercentState(this.savedZoom);
        } else {
            view.fit();

            return this;
        }
    }

    public toggleOverview(view: View, x: number, y: number): IViewState {
        view.zoomTo(x, y, this.savedZoom);

        return new FixedNormalState();
    }
}

export interface IViewEventListener {
    onZoomModeChanged(zoomMode: ZoomMode): void;
    onLayoutChanged(x: number, y: number, zoom: number): void;
}

export class Controller {
    public static createFixed(
        width: number,
        height: number,
        contentWidth: number,
        contentHeight: number,
        contentMargin: number,
        viewEventListener: IViewEventListener,
        zoomStep: number): Controller {
        const [view, state] = FixedState.create(width, height, contentWidth, contentHeight, contentMargin);

        return new Controller(view, zoomStep, viewEventListener, state);
    }

    public static createFit(
        width: number,
        height: number,
        contentWidth: number,
        contentHeight: number,
        contentMargin: number,
        viewEventListener: IViewEventListener,
        zoomStep: number): Controller {
        const [view, state] = FitState.create(width, height, contentWidth, contentHeight, contentMargin);

        return new Controller(view, zoomStep, viewEventListener, state);
    }

    public static createAutoFit(
        width: number,
        height: number,
        contentWidth: number,
        contentHeight: number,
        contentMargin: number,
        viewEventListener: IViewEventListener,
        zoomStep: number): Controller {
        const [view, state] = AutoFitState.create(width, height, contentWidth, contentHeight, contentMargin);

        return new Controller(view, zoomStep, viewEventListener, state);
    }

    private constructor(
        private readonly view: View,
        private readonly zoomStep: number,
        private readonly viewEventListener: IViewEventListener,
        private state: IViewState) {
        this.notifyLayoutChanged();
        this.notifyZoomingModeChanged();
    }

    public resize(width: number, height: number): void {
        this.state = this.state.resize(this.view, width, height);

        this.notifyLayoutChanged();
    }

    public toggleOverview(x: number, y: number): void {
        this.state = this.state.toggleOverview(this.view, x, y);

        this.notifyLayoutChanged();
        this.notifyZoomingModeChanged();
    }

    public zoomIn(x: number, y: number): void {
        this.zoomTo(x, y, this.view.zoom * this.zoomStep);
    }

    public zoomOut(x: number, y: number): void {
        this.zoomTo(x, y, this.view.zoom / this.zoomStep);
    }

    public beginDrag(x: number, y: number): (x: number, y: number) => void {
        const offsetX = this.view.contentX - x;
        const offsetY = this.view.contentY - y;

        return (x1, y1) => {
            this.view.contentX = offsetX + x1;
            this.view.contentY = offsetY + y1;

            this.notifyLayoutChanged();

            this.state.decay((viewState) => {
                this.state = viewState;
                this.notifyZoomingModeChanged();
            });
        };
    }

    private notifyLayoutChanged(): void {
        this.viewEventListener.onLayoutChanged(this.view.contentX, this.view.contentY, this.view.zoom);
    }

    private notifyZoomingModeChanged(): void {
        this.viewEventListener.onZoomModeChanged(this.state.zoomMode);
    }

    private zoomTo(x: number, y: number, value: number): void {
        this.view.zoomTo(x, y, value);

        this.notifyLayoutChanged();

        if (!(this.state instanceof FixedNormalState)) {
            this.state = new FixedNormalState();

            this.notifyZoomingModeChanged();
        }
    }
}