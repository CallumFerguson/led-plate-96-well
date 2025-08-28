import plateUrl from '../assets/96-Well_plate.svg?url';

const WellPlate96 = () => {
    return (
        <div className="relative inline-block">
            <img
                src={plateUrl}
                alt="96-well plate"
                className="block select-none pointer-events-none max-w-full h-auto"
                draggable={false}
                loading="lazy"
            />

            {/* Overlay matches image size exactly */}
            <div
                className="absolute inset-0 grid grid-cols-12 grid-rows-8 grid-flow-col p-[6%]"
                // optional: keep your debug bg/padding in px if you want
                style={{
                    paddingTop: '26px',
                    paddingBottom: '26px',
                    paddingLeft: '38px',
                    paddingRight: '37px',
                    // background: 'red',
                }}
            >
                {Array.from({ length: 96 }, (_, i) => (
                    <div
                        key={i}
                        className="w-[31px] h-[31px] rounded-full bg-black/40 place-self-center"
                    >
                        {/* {i} */}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WellPlate96;
