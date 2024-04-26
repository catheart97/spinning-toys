export interface IUpdateable {
    init(): Promise<void>
    update(dt: number): void
}