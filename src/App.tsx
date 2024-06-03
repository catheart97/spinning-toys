import React from "react"
import Simulation, { SimulationScene } from "./Simulation"

import Licenses from "../licenses.json";

export const App = () => {
    const [simulation, setSimulation] = React.useState<JSX.Element | undefined>()
    const dialogRef = React.useRef<HTMLDialogElement>()
    return (
        simulation ?? (
            <>
                <div className="h-[100dvh] w-full bg-black flex justify-start items-start flex-col gap-4 p-4 text-white">
                    <div className="text-4xl">
                        Spinning Toys
                    </div>
                    <div>
                        Click on a toy to start the simulation.
                    </div>
                    <div className="border-white border-b-2 h-1 w-full"></div>
                    <div className="grow flex flex-wrap gap-2 items-center justify-around w-full">
                        {
                            Object.keys(SimulationScene).map((k, i) => {
                                return (
                                    <button
                                        key={i}
                                        className="text-white p-2 w-44 h-44 rounded-3xl border-2 border-white hover:bg-white hover:text-black transition-all ease-in-out duration-200 hover:scale-110"
                                        onClick={() => setSimulation(<Simulation scene={SimulationScene[k]} />)}
                                    >
                                        {k}
                                    </button>
                                )
                            })
                        }
                    </div>
                    <div className="border-white border-b-2 h-1 w-full"></div>
                    <div className="text-sm flex justify-end w-full gap-8 flex-wrap">
                        <button
                            onClick={() => dialogRef.current.showModal()}
                            className="text-white font-bold hover:scale-110 ease-in-out transition-all duration-200"
                        >
                            About & Legal
                        </button>
                        <a href="https://catheart97.github.io" className="text-white font-bold hover:scale-110 ease-in-out transition-all duration-200 flex items-center gap-2"><i className="bi bi-github text-white text-2xl"></i> catheart97.github.io</a>
                    </div>
                </div>
                <dialog ref={dialogRef} className="w-[100dvw] min-h-[100dvh] min-w-[100dvw] h-[100dvh] m-0 bg-black/80 p-44">
                    <div className="rounded-3xl bg-white w-full h-full text-black overflow-hidden flex flex-col gap-2">
                        <div className="h-8 flex justify-end">
                            <button
                                onClick={() => dialogRef.current.close()}
                                className="transition-all ease-in-out duration-200 hover:scale-110 rounded-full p-2 focus:outline-none p-6"
                            >
                                <i className="bi bi-x text-2xl"></i>
                            </button>
                        </div>
                        <div className="grow flex flex-col gap-2 overflow-y-scroll p-6">
                            <div className="font-bold uppercase">About</div>
                            <p>
                                For more legal information about this site please visit: <a href="https://catheart97.github.io">catheart97.github.io</a>.
                            </p>
                            <div className="font-bold uppercase">
                                Open Source Licenses
                            </div>
                            <div className="">
                                {
                                    Object.keys(Licenses).map((l, i) => {
                                        const data = Licenses[l];
                                        return (
                                            <div key={i} className="flex justify-between">
                                                <div>{l}</div>
                                                <div>{data.licenses}</div>
                                            </div>
                                        )
                                    })
                                }
                            </div>
                        </div>
                    </div>
                </dialog>
            </>
        )
    )
}